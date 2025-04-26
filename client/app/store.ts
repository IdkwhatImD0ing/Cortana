import { createStore, combineReducers, compose, applyMiddleware } from 'redux';
import keplerGlReducer, { enhanceReduxMiddleware } from '@kepler.gl/reducers';
import { taskMiddleware } from 'react-palm/tasks';

// Mount the kepler.gl reducer with your previous defaults
const rootReducer = combineReducers({
  keplerGl: keplerGlReducer.initialState({
    uiState: {
      readOnly: false,      // full UI by default (for admin)
      currentModal: null
    }
  }),
  // …other reducers…
});

const enhancer = compose(
  applyMiddleware(...enhanceReduxMiddleware([taskMiddleware]))
);

const store = createStore(rootReducer, {}, enhancer);

export default store;
