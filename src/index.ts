import { DurableObject } from "cloudflare:workers";

/**
 * Welcome to Cloudflare Workers! This is your first Durable Objects application.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your Durable Object in action
 * - Run `npm run deploy` to publish your application
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/durable-objects
 */


interface LocationInfo {
	city: string;
	country: string;
	region: string;
	timezone: string;
	latitude: string;
	longitude: string;
	postalCode: string;
	colo: string;
}

interface StoredData {
	counter: number;
	location: LocationInfo;
	timestamp: number;
}

interface ResponseData {
	current: StoredData;
	previous: StoredData | null;
}

/** A Durable Object's behavior is defined in an exported Javascript class */
export class MyDurableObject extends DurableObject {
	/**
	 * The constructor is invoked once upon creation of the Durable Object, i.e. the first call to
	 * 	`DurableObjectStub::get` for a given identifier (no-op constructors can be omitted)
	 *
	 * @param ctx - The interface for interacting with Durable Object state
	 * @param env - The interface to reference bindings declared in wrangler.jsonc
	 */
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
	}

	/**
	 * Get and increment the counter, and store location
	 * @param locationInfo - The location information from the request
	 * @returns The stored data including current and previous counter/location
	 */
	async getCounter(locationInfo: LocationInfo): Promise<ResponseData> {
		// Load current and previous data from storage
		const currentData = await this.ctx.storage.get<StoredData>('current');
		const previousData = await this.ctx.storage.get<StoredData>('previous');

		// Initialize counters if first run
		let previous_counter = 1;
		let counter = 2;
		
		if (currentData) {
			// Calculate next Fibonacci number
			previous_counter = currentData.counter;
			const prevCounter = previousData?.counter || 1;
			counter = prevCounter + currentData.counter;
		}

		// Prepare new current data
		const newCurrentData: StoredData = {
			counter: counter,
			location: locationInfo,
			timestamp: Date.now()
		};

		// Store previous data (what was current)
		if (currentData) {
			await this.ctx.storage.put('previous', currentData);
		}

		// Store new current data
		await this.ctx.storage.put('current', newCurrentData);

		return {
			current: newCurrentData,
			previous: currentData || null
		};
	}
}

export default {
	/**
	 * This is the standard fetch handler for a Cloudflare Worker
	 *
	 * @param request - The request submitted to the Worker from the client
	 * @param env - The interface to reference bindings declared in wrangler.jsonc
	 * @param ctx - The execution context of the Worker
	 * @returns The response to be sent back to the client
	 */
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);
		
		// Extract location information from Cloudflare's cf object
		const cf = request.cf;
		const locationInfo = {
			city: cf?.city || 'Unknown',
			country: cf?.country || 'Unknown',
			region: cf?.region || 'Unknown',
			timezone: cf?.timezone || 'Unknown',
			latitude: cf?.latitude || 'Unknown',
			longitude: cf?.longitude || 'Unknown',
			postalCode: cf?.postalCode || 'Unknown',
			colo: cf?.colo || 'Unknown', // Cloudflare data center
		};
		
		// Create a stub to open a communication channel with the Durable Object
		// instance named "foo".
		//
		// Requests from all Workers to the Durable Object instance named "foo"
		// will go to a single remote Durable Object instance.
		const stub = env.MY_DURABLE_OBJECT.getByName("foo");

		// Handle /message endpoint to return counter value
		if (url.pathname === '/message') {
			const data = await stub.getCounter(locationInfo);
			return new Response(JSON.stringify(data), {
				headers: { 'Content-Type': 'application/json' }
			});
		}

		return new Response("Durable Object is running");
	},
} satisfies ExportedHandler<Env>;
