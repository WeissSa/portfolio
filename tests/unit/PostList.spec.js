import { shallowMount } from '@vue/test-utils';
import PostList from '../../src/components/PostList.vue';
import posts from '../../src/assets/posts.json';
import Vuex from 'vuex';

describe('PostList', () => {
  let wrapper;
  let store = Vuex.createStore({
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
  const getWrapper = () =>
    shallowMount(PostList, {
      global: {
        plugins: [store],
      },
    });

  it('should display a post for every post in posts by default', async () => {
    wrapper = getWrapper();
    posts.forEach((post) => {
      expect(wrapper.html()).toContain(post.description);
    });
  });

  it('should filter/unfilter posts by a single tag', async () => {
    store.commit('ADD_TAG', 'Godot');
    wrapper = getWrapper();
    posts.forEach((post) => {
      if (post.tags.includes('Godot')) {
        expect(wrapper.html()).toContain(post.description);
      } else {
        expect(wrapper.html()).not.toContain(post.description);
      }
    });
    store.commit('REMOVE_TAG', 'Godot');
    wrapper = getWrapper();
    posts.forEach((post) => {
      expect(wrapper.html()).toContain(post.description);
    });
  });

  it('should include ALL posts which have at least 1 tag filtered', async () => {
    store.commit('ADD_TAG', 'Godot');
    store.commit('ADD_TAG', 'Web Development');
    wrapper = getWrapper();
    posts.forEach((post) => {
      if (
        post.tags.includes('Godot') ||
        post.tags.includes('Web Development')
      ) {
        expect(wrapper.html()).toContain(post.description);
      } else {
        expect(wrapper.html()).not.toContain(post.description);
      }
    });
  });
});
