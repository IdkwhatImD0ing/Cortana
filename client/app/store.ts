// store/store.js
import { applyMiddleware, combineReducers, compose, createStore } from 'redux';
import keplerGlReducer, { enhanceReduxMiddleware } from '@kepler.gl/reducers';

// Combine your reducers
const reducers = combineReducers({
  // Mount Kepler.gl reducer, potentially with initial UI state
  keplerGl: keplerGlReducer.initialState({
    uiState: {
      readOnly: false, // Example: Set readOnly mode if needed
      currentModal: null
      // You could potentially set other initial UI states here
    }
  }),
  // Add other reducers for your app here if you have them
  // app: myAppReducer,
});

// Define middlewares
const middleWares = enhanceReduxMiddleware([
  // Add other middlewares (like thunk, saga, etc.) here if needed
]);

// Compose enhancers
// Check if Redux DevTools Extension is available
const composeEnhancers = typeof window !== 'undefined' && window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;
const enhancers = composeEnhancers(applyMiddleware(...middleWares));

// Create store
const initialState = {};
const store = createStore(
  reducers,
  initialState,
  enhancers
);

export default store;