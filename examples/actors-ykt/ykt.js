const express = require('express')
const { logger, jsonParser, errorHandler, shutdown, actor, actorRuntime } = require('kar')

const app = express()

app.use(logger, jsonParser) // enable kar logging and parsing

app.post('/shutdown', async (_reg, res) => {
  console.log('Shutting down service')
  res.sendStatus(200)
  await shutdown()
  server.close(() => process.exit())
})

const truthy = s => s && s.toLowerCase() !== 'false' && s !== '0'
const verbose = truthy(process.env.VERBOSE)

let delayStats = []
const delayStatsBucketMS = 100

function randI (max) { return Math.floor(Math.random() * Math.floor(max)) }

// YKT Office Encoding:  aisle:flooroffice   TODO: KAR should be able to use '-' instead of ':' as a separator
const Cafeteria = '22:001'
const OutTakes = '21:001'
function randomOffice () {
  const floor = randI(3)
  const aisle = 1 + randI(40)
  const office = 1 + randI(64)
  return `${aisle}:${floor}${office}`
}
function getAisle (office) { return office.split(':')[0] }
function getFloor (office) { return office.split(':')[1][0] }
function getRoom (office) { return office.split(':')[1] }

// Common superclass for Office, Floor, and Site (things that count their occupants)
class ActorWithCount {
  get count () { return this._count }
  async updateCount (newCount) {
    this._count = newCount
    await this.sys.set('count', newCount)
  }

  async activate () {
    this._count = await this.sys.get('count') || 0
    if (verbose) console.log(`activated ${this.sys.type}/${this.sys.id} with count ${this.count}`)
  }

  deactivate () {
    if (verbose) console.log(`deactivated ${this.sys.type}/${this.sys.id}`)
  }

  async clear () {
    await this.updateCount(0)
  }

  async increment () {
    await this.updateCount(this.count + 1)
    if (verbose) console.log(`increment ${this.sys.type}/${this.sys.id} count is now ${this.count}`)
  }

  async decrement () {
    await this.updateCount(this.count - 1)
    if (verbose) console.log(`decrement ${this.sys.type}/${this.sys.id} count is now ${this.count}`)
  }
}

class Site extends ActorWithCount {
  get nextSerialNumber () { return this._nextSerialNumber }
  async updateNextSerialNumber (nextSerialNumber) {
    this._nextSerialNumber = nextSerialNumber
    await this.sys.set('nextSerialNumber', nextSerialNumber)
  }

  async activate () {
    this._nextSerialNumber = await this.sys.get('nextSerialNumber') || 0
    await super.activate()
  }

  async clear () {
    await this.updateNextSerialNumber(0)
    await super.clear()
    await actor.Floor[0].clear()
    await actor.Floor[1].clear()
    await actor.Floor[2].clear()
    await actor.Office[Cafeteria].clear()
    await actor.Office[OutTakes].clear()
  }

  async stopReporting () {
    await this.sys.cancelReminder('siteReport')
  }

  async startReporting (period = '10s') {
    await this.sys.cancelReminder({ id: 'siteReport' })
    await this.sys.scheduleReminder('siteReport', { id: 'siteReport', deadline: '1s', period: period })
  }

  async enter (name = 'anon') {
    console.log(`${name} entered Site ${this.sys.id}`)
    await this.increment()
  }

  async leave (name = 'anon') {
    console.log(`${name} left Site ${this.sys.id}`)
    await this.decrement()
  }

  async workDay ({ workers = 3, steps = 20 } = {}) {
    console.log(`${workers} starting their shift of ${steps} tasks at ${this.sys.id}`)
    const sn = this.nextSerialNumber
    await this.updateNextSerialNumber(sn + workers)
    for (var i = 0; i < workers; i++) {
      const name = sn + i
      actor.Researcher[name].work({ site: this.sys.id, steps }) // Intentionally async.  Initiate work but don't wait for it to start
    }
  }

  async siteReport () {
    const totalWorking = await this.count
    const floor0 = await actor.Floor[0].count()
    const floor1 = await actor.Floor[1].count()
    const floor2 = await actor.Floor[2].count()
    const coffee = await actor.Office[OutTakes].count()
    const cafeteria = await actor.Office[Cafeteria].count()
    const time = new Date().toString()

    const status = { totalWorking, floor0, floor1, floor2, coffee, cafeteria, time }
    console.log(status)
    // TODO: publish siteReport to KAR pub-sub
    // await publish('siteReport', status)
    return status
  }

  async searchParty () {
    const lost = []
    for (var i = 0; i < this.nextSerialNumber; i++) {
      const s = await actor.Researcher[i].currentState()
      if (s.location) {
        console.log(`Researcher ${i} is found at `, s)
        lost.push(i)
      }
    }
    return lost
  }

  async delayReport () {
    for (const i in delayStats) {
      console.log(`<${i * delayStatsBucketMS}ms\t${delayStats[i]}`)
    }
    return { bucketSizeInMS: delayStatsBucketMS, delayHistogram: delayStats }
  }

  resetDelayStats () {
    delayStats = []
  }
}

class Floor extends ActorWithCount {
}

class Office extends ActorWithCount {
  getAisle () { return getAisle(this.sys.id) }
  getFloor () { return getFloor(this.sys.id) }
  getRoom () { return getRoom(this.sys.id) }
  isEmpty () { return this.count === 0 }

  prettyName () {
    if (this.sys.id === OutTakes) { return 'OutTakes' }
    if (this.sys.id === Cafeteria) { return 'Cafeteria' }
    return `${this.getAisle()}-${this.getRoom()}`
  }

  async enter (name = 'anon') {
    if (verbose) console.log(`Office: ${name} entered office ${this.prettyName()}`)
    await this.increment()
    await actor.Floor[this.getFloor()].increment()
  }

  async leave (name = 'anon') {
    if (verbose) console.log(`Office: ${name} left office ${this.prettyName()}`)
    await this.decrement()
    await actor.Floor[this.getFloor()].decrement()
  }
}

class Researcher {
  get name () { return this.sys.id }

  get location () { return this._state.location }
  set location (loc) { this._state.location = loc }

  get site () { return this._state.site }
  set site (s) { this._state.site = s }

  get steps () { return this._state.steps }
  set steps (s) { this._state.steps = s }

  currentState () { return this._state }
  async checkpointState () {
    await this.sys.set('state', this._state)
  }

  async activate () {
    this._state = await this.sys.get('state') || {}
    if (verbose) console.log(`activated Researcher ${this.name} with state `, this._state)
  }

  async deactivate () {
    if (verbose) console.log(`deactivated Researcher ${this.name}`)
  }

  async work ({ site, steps }) {
    this.site = site
    this.steps = steps
    this.location = randomOffice()
    const delay = randI(10)
    await this.checkpointState()
    await actor.Site[site].enter(this.name)
    await actor.Office[this.location].enter(this.name)
    const deadline = Date.now() + 1000 * delay
    await this.sys.scheduleReminder('move', { id: 'move', deadline, data: { target: deadline } })
  }

  async move ({ data }) {
    const now = Date.now()
    const missedMS = Math.abs(now - data.target)
    const missedBucket = Math.floor(missedMS / delayStatsBucketMS)
    delayStats[missedBucket] = (delayStats[missedBucket] || 0) + 1
    if (verbose) console.log(`Researcher: ${this.name} entered move`)
    const oldLocation = this.location
    await actor.Office[oldLocation].leave(this.name)

    this.steps = this.steps - 1
    if (this.steps === 0) {
      await actor.Site[this.site].leave(this.name)
      await this.sys.delete('state')
      console.log(`Quitting time for ${this.name}`)
    } else {
      const nextMove = Math.random()
      let nextLocation
      let thinkTime = 1 + randI(10)
      if (nextMove < 0.15) {
        // 15% chance of getting coffee
        nextLocation = OutTakes
        console.log(`Coffee time for ${this.name}`)
      } else if (nextMove < 0.20) {
        // 5% chance of lunchtime
        nextLocation = Cafeteria
        thinkTime = thinkTime * 2
        console.log(`Lunch time for ${this.name}`)
      } else {
        nextLocation = randomOffice()
        if (!await actor.Office[nextLocation].isEmpty()) {
          thinkTime = thinkTime * 3
          console.log(`${this.name} is heading to a meeting at ${nextLocation}`)
        }
      }

      this.location = nextLocation
      await this.checkpointState()
      await actor.Office[this.location].enter(this.name)
      if (verbose) console.log(`Researcher: ${this.name} starting reminder update`)
      const deadline = Date.now() + 1000 * thinkTime
      await this.sys.scheduleReminder('move', { id: 'move', deadline, data: { target: deadline } })
      if (verbose) console.log(`Researcher: ${this.name} completed reminder update`)
    }
    if (verbose) console.log(`Researcher: ${this.name} exited move`)
  }
}
app.use(actorRuntime({ site: Site, floor: Floor, office: Office, researcher: Researcher }))

app.use(errorHandler) // enable kar error handling

const server = app.listen(process.env.KAR_APP_PORT, '127.0.0.1')