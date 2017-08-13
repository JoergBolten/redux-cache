import { DEFAULT_KEY } from "./constants";
import { INVALIDATE_CACHE, InvalidateCacheAction } from "./actions";

export interface Store {
	[x: string]: any,
	replaceReducer: (reducer: () => State) => Function
}

export interface State {
	DEFAULT_KEY?: number | null | undefined
	[x: string]: any,
}

export interface CacheEnhancerConfig {
	log?: boolean
}

const logResult = (name: string, array: string[]): void => {
	console.log("redux-cache: %s: %s", name, array.join(", ") || "none found");
};

export const updateState = (reducersToInvalidate, currentState, { log = false }) => {
	const newState = { ...currentState };
	const stateKeys = Object.keys(newState);

	// We filter to those reducers which exist in the application state tree
	const matchedReducers = reducersToInvalidate.filter(reducerKey => {
		const matched = (stateKeys.indexOf(reducerKey) !== -1);
		if (!matched) { console.log("redux-cache: did not match %s reducer to state tree", reducerKey); }
		return matched;
	});
	if (log) { logResult("matchedReducers", matchedReducers); }

	// We filter those existing reducers down to those which actually have a the cache key.
	const cacheEnabledReducers = matchedReducers.filter(reducerKey => {
		return newState && newState[reducerKey] && newState[reducerKey][DEFAULT_KEY];
	});
	if (log) { logResult("cacheEnabledReducers", cacheEnabledReducers); }

	// We are invalidating the cached reducers by setting the value for the cache key to null.
	// Don't fret -- they'll get a new and improved value for the cache key again when the successful action comes through.
	cacheEnabledReducers.forEach(reducerKey => { newState[reducerKey][DEFAULT_KEY] = null; });
	if (log) {
		if (cacheEnabledReducers.length > 0) {
			console.log("redux-cache: Set %s to null for following reducers: %s", DEFAULT_KEY, cacheEnabledReducers.join(", "));
		} else {
			console.log("redux-cache: No cached reducers to update");
		}
	}

	return newState;
};

export const liftReducer = (reducer, config) => (state, action) => {
	if (action.type !== INVALIDATE_CACHE) {
		return reducer(state, action);
	}

	const reducersToInvalidate = action.payload && action.payload.reducers || [];
	const currentState = reducer(state, action);
	const newState = updateState(reducersToInvalidate, currentState, config);

	return newState;
}

/**
 * 
 * @param config 
 * @returns {Object} - returns the enhanced store
 */
const cacheEnhancer = (config: CacheEnhancerConfig = {}) => {
	return (createStore) => (rootReducer, initialState, enhancer) => {
		const store = createStore(liftReducer(rootReducer, config), initialState, enhancer);

		return { 
			...store,
			replaceReducer: (reducer) => {
				return store.replaceReducer(liftReducer(reducer, config));
			}
		}
	}
}