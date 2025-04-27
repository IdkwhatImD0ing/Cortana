// store.ts
import { createStore, combineReducers, applyMiddleware, compose, Store } from 'redux';
import keplerGlReducer from '@kepler.gl/reducers';
import { taskMiddleware } from 'react-palm/tasks';

// Define the shape of your Redux state
export interface RootState {
  keplerGl: ReturnType<typeof keplerGlReducer>;
}

// Combine KeplerGL reducer under `keplerGl`
const rootReducer = combineReducers<RootState>({
  keplerGl: keplerGlReducer()
});

// Allow Redux DevTools extension if present
declare global {
  interface Window {
    __REDUX_DEVTOOLS_EXTENSION_COMPOSE__?: typeof compose;
  }
}

// Compose enhancers: middleware + DevTools
const composeEnhancers =
  (typeof window !== 'undefined' && window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__) ||
  compose;

const enhancer = composeEnhancers(
  applyMiddleware(taskMiddleware)
);

// Create the Redux store
const store: Store<RootState> = createStore(
  rootReducer,
  enhancer
);

export default store;
