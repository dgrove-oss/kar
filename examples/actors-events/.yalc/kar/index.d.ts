// Type definitions for [KAR] [0.1.0]
// Project:[KAR:Kubernetes Application Runtime]

import { Server } from "spdy";
import { Application, Router } from "express";

export interface ActorImpl {
  /** The type of this Actor instance */
  type: string;
  /** The id of this Actor instance */
  id: string;
  /** The session of the active invocation */
  session?: string;
}

/**
 * An Actor instance
 */
export interface Actor {
  kar: ActorImpl
}

/**
 * A Reminder
 */
export interface Reminder {
  /** The actor to be reminded */
  actor: ActorImpl;
  /** The id of this reminder */
  id: string;
  /** The time at which the reminder is eligible for delivery */
  targetTime: Date;
  /** The actor method to be invoked */
  path: string;
  /** An array of arguments with which to invoke the target method */
  data?: any[];
  /** Period at which the reminder should recur in nanoseconds. A value of 0 indicates a non-recurring reminder */
  period: number;
}

export interface ScheduleReminderOptions {
  /** The id of the reminder being scheduled */
  id: string;
  /** The earliest time at which the reminder should be delivered */
  targetTime: Date
  /**  For periodic reminders, a string encoding a Duration representing the desired gap between successive reminders */
  period?: string
}

/**
 * Asynchronous service invocation; returns "OK" immediately
 * @param service The service to invoke.
 * @param path The service endpoint to invoke.
 * @param body The request body with which to invoke the service endpoint.
 */
export function tell (service: string, path: string, body: any): Promise<any>;

/**
 * Synchronous service invocation; returns invocation result
 * @param service The service to invoke.
 * @param path The service endpoint to invoke.
 * @param body The request body with which to invoke the service endpoint.
 * @returns The result returned by the target service.
 */
export function call (service: string, path: string, body: any): Promise<any>;

/**
 * Publish a CloudEvent to a topic
 * @param {*} TODO: Document this API when it stabalizes
 */
export function publish ();

/**
 * Subscribe a Service endpoint to a topic.
 * @param topic The topic to which to subscribe
 * @param path The endpoint to invoke for each event received on the topic
 * @param opts TODO: Document expected structure
 */
export function subscribe (topic: string, path: string, opts: any): Promise<any>;

/**
 * Unsubscribe from a topic.
 * @param topic The topic to which to subscribe
 * @param opts TODO: Document expected structure
 */
export function unsubscribe (topic: string, opts: any): Promise<any>;

/**
 * Actor operations
 */
export namespace actor {

  /**
   * Construct a proxy object that represents an Actor instance.
   * @param type The type of the Actor instance
   * @param id The instance id of the Actor instance
   * @returns A proxy object representing the Actor instance.
   */
  export function proxy (type: string, id: string): Actor;

  /**
   * Asynchronous actor invocation; returns "OK" immediately
   * @param actor The target actor.
   * @param path The actor method to invoke.
   * @param args The arguments with which to invoke the actor method.
   */
  export function tell (callee: Actor, path: string, ...args: any[]): Promise<any>;

  /**
   * Synchronous actor invocation propagating current session; returns the result of the invoked Actor method.
   * @param from The actor making the call
   * @param callee The target actor.
   * @param path The actor method to invoke.
   * @param args The arguments with which to invoke the actor method.
   */
  export function call (from: Actor, callee: Actor, path: string, ...args: any[]): Promise<any>;

  /**
   *  Synchronous actor invocation creating a new session; returns the result of the invoked Actor method.
   * @param callee The target Actor.
   * @param path The actor method to invoke.
   * @param args The arguments with which to invoke the actor method.
   */
  export function call (callee: Actor, path: string, ...args: any[]): Promise<any>;

  /**
   * Subscribe an Actor instance method to a topic.
   * @param actor The Actor instance to subscribe
   * @param topic The topic to which to subscribe
   * @param path The endpoint to invoke for each event received on the topic
   * @param opts TODO: Document expected structure
   */
  export function subscribe (actor: Actor, topic: string, path: string, opts: any): Promise<any>

  namespace reminders {
    /**
     * Cancel matching reminders for an Actor instance.
     * @param actor The Actor instance.
     * @param reminderId The id of a specific reminder to cancel
     * @returns The number of reminders that were cancelled.
     */
    export function cancel (actor: Actor, reminderId?: string): Promise<number>;

    /**
     * Get matching reminders for an Actor instance.
     * @param actor The Actor instance.
     * @param reminderId The id of a specific reminder to cancel
     * @returns An array of matching reminders
     */
    export function get (actor: Actor, reminderId?: string): Promise<Reminder | Array<Reminder>>;

    /**
     * Schedule a reminder for an Actor instance.
     * @param actor The Actor instance.
     * @param path The actor method to invoke when the reminder fires.
     * @param options.id The id of the reminder being scheduled
     * @param options.targetTime The earliest time at which the reminder should be delivered
     * @param options.period For periodic reminders, a string encoding a Duration representing the desired gap between successive reminders
     * @param args The arguments with which to invoke the actor method.
     */
    export function schedule (actor: Actor, path: string, options: ScheduleReminderOptions, ...args: any[]): Promise<any>;
  }

  namespace state {
    /**
     * Get one value from an Actor's state
     * @param actor The Actor instance.
     * @param key The key to get from the instance's state
     * @param subkey The optional subkey to get from the instance's state
     * @returns The value associated with `key` or `key/subkey`
     */
    export function get (actor: Actor, key: string, subkey?: string): Promise<any>;

    /**
     * Check to see if an Actor's state contains an entry
     * @param actor The Actor instance.
     * @param key The key to check for in the instance's state
     * @param subkey The optional subkey to check for in the instance's state
     * @returns `true` if the actor has a state entry for `key` or `key/subkey` and `false` if it does not
     */
    export function contains (actor: Actor, key: string, subkey?: string): Promise<boolean>;

    /**
     * Store one value to an Actor's state
     * @param actor The Actor instance.
     * @param key The key to update in the instance's state
     * @param value The value to store
     */
    export function set (actor: Actor, key: string, value: any): Promise<void>;

    /**
     * Store one value to an Actor's state
     * @param actor The Actor instance.
     * @param key The key to update in the instance's state
     * @param subkey The optional subkey to update in the instance's state
     * @param value The value to store
     */
    export function setWithSubkey (actor: Actor, key: string, subkey: string, value: any): Promise<void>;

    /**
     * Store multiple values to an Actor's state
     * @param actor The Actor instance.
     * @param updates The updates to make
     */
    export function setMultiple (actor: Actor, updates: Map<string, any>): Promise<void>;

    /**
     * Remove one value from an Actor's state
     * @param actor The Actor instance.
     * @param key The key to delete
     * @param subkey The optional subkey to delete
     */
    export function remove (actor: Actor, key: string, subkey?: string): Promise<void>;

    /**
     * Get all of an Actor's state
     * @param actor The Actor instance.
     * @returns A map representing the Actor's state
     */
    export function getAll (actor: Actor): Promise<Map<string, any>>;

    /**
     * Remove an Actor's state
     * @param actor The Actor instance.
     */
    export function removeAll (actor: Actor): Promise<void>;

    /**
     * Get the subkeys associated with the given key
     * @param actor The Actor instance
     * @param key The key
     * @returns An array containing the currently defined subkeys
     */
    export function subMapGetKeys(actor: Actor, key: string):Promise<Array<string>>;

    /**
     * Get the number of subkeys associated with the given key
     * @param actor The Actor instance
     * @param key The key
     * @returns The number of currently define subkeys
     */
    export function subMapSize(actor: Actor, key: string):Promise<number>;

    /**
     * Remove all subkeys associated with the given key
     * @param actor The Actor instance
     * @param key The key
     * @returns The number of removed subkey entrys
     */
    export function subMapClear(actor: Actor, key: string):Promise<number>;
  }
}

/**
 * Application configuration and system operations
 */
export namespace sys {
  /**
   * Instantiate an actor runtime for this application process by
   * providing it a collection of classes that implement Actor types.
   * @param actors The actor types implemented by this application component.
   * @returns Router that will serve routes designated for the actor runtime
   */
  export function actorRuntime (actors:  { [k:string]: ()=>Object }): Router;

  /**
   * Wrap an Express App in an http/2 server.
   * @param app An Express App
   * @returns a Server
   */
  export function h2c (app: Application): Server;

  /**
   * Error handling middleware
   * TODO: proper type & documentation
   */
  export const errorHandler: any;

  /**
   * Kill this sidecar
   */
  export function shutdown (): Promise<void>;
}
