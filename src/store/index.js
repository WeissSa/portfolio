import { createStore } from "vuex";

export default createStore({
  state: {
    currentTag: null,
  },
  mutations: {
    SET_TAG(state, tag) {
      state.currentTag = tag;
    },
  },
});
