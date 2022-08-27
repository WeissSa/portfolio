import { shallowMount } from "@vue/test-utils";
import PostList from "../../src/components/PostList.vue";
import posts from "../../src/assets/posts.json";
import Vuex from "vuex";

const store = Vuex.createStore({
  state: {
    currentTags: [],
  },
});

describe("PostList", () => {
  let wrapper;
  const getWrapper = () =>
    shallowMount(PostList, {
      global: {
        plugins: [store],
      },
    });
  it("should display a post for every post in posts", async () => {
    wrapper = getWrapper();
    posts.forEach((post) => {
      expect(wrapper.html()).toContain(post.description);
    });
  });
});
