import { createStore } from "vuex";

export default createStore({
  state: {
    currentTags: [],
  },
  mutations: {
    ADD_TAG(state, tag) {
      state.currentTags.push(tag);
    },
    REMOVE_TAG(state, tag) {
      state.currentTags = state.currentTags.filter((t) => t !== tag);
    },
  },
});
