package com.ibm.research.kar;

import java.util.Map;

import javax.enterprise.context.ApplicationScoped;
import javax.inject.Inject;
import javax.ws.rs.PathParam;
import javax.ws.rs.ProcessingException;
import javax.ws.rs.core.Response;

import org.eclipse.microprofile.rest.client.inject.RestClient;

@ApplicationScoped // change as needed
public class Kar {

	@Inject
	@RestClient
	private KarRest karClient;

	
	/******************
	 * Public methods
	 ******************/

	// asynchronous service invocation, returns "OK" immediately
	public Response tell(String service, String path, Map<String,Object> params) throws ProcessingException {
		return karClient.tell(service, path, params);
	}

	// synchronous service invocation, returns invocation result
	public Response call(String service, String path, Map<String,Object> params) throws ProcessingException {
		return karClient.call(service, path, params);
	}

	// asynchronous actor invocation, returns "OK" immediately
	public Response actorTell(String type, String id, String path, Map<String,Object> params) throws ProcessingException {
		return karClient.actorTell(type, id, path, params);
	}

	// synchronous actor invocation: returns invocation result
	public Response actorCall(String type, String id,  String path, Map<String,Object> params) throws ProcessingException {
		return karClient.actorCall(type, id, path, params);
	}

	
	/*
	 * Reminder Operations
	 */
	public Response actorCancelReminder(String type, String id, Map<String,Object> params) throws ProcessingException {
		return karClient.actorCancelReminder(type, id, params);

	}

	public Response actorGetReminder(String type, String id, Map<String,Object> params) throws ProcessingException {
		return karClient.actorGetReminder(type, id, params);

	}

	public Response actorScheduleReminder(String type, String id, String path, Map<String,Object> params) throws ProcessingException {
		params.put("path", "/"+"path");
		return karClient.actorScheduleReminder(type, id, params);
	}


	// broadcast to all sidecars except for ours
	public Response broadcast(@PathParam("path") String path, Map<String,Object> params) throws ProcessingException {
		return karClient.broadcast(path, params);
	}
	
	/*
	 * Actor State Operations
	 */
    public Response actorGetState( String type,  String id,  String key) throws ProcessingException {
    	return karClient.actorGetState(type, id, key);
    }

    public Response actorSetState(String type,  String id,  String key, Map<String,Object> params) throws ProcessingException {
    	return karClient.actorSetState(type, id, key, params);
    }

    public Response actorDeleteState(String type,  String id,  String key) throws ProcessingException {
    	return karClient.actorDeleteState(type, id, key);
    }
    public Response actorGetAllState(String type,  String id) throws ProcessingException {
    	return karClient.actorGetAllState(type, id);
}

    public Response actorDeleteAllState(String type,  String id) throws ProcessingException {
    	return karClient.actorDeleteAllState(type, id);
    }

}