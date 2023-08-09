import { shallowMount } from "@vue/test-utils";
import TagLister from "../../src/components/TagLister.vue";
import posts from "../../src/assets/posts.json";
import Vuex from "vuex";

const baseProps = posts;
describe("TagLister", () => {
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
  const getWrapper = (props) =>
    shallowMount(TagLister, {
      global: {
        plugins: [store],
      },
      props,
    });

  it("should display a tag for every tag", async () => {
    wrapper = getWrapper({ posts: baseProps });
    baseProps.forEach((post) => {
      post.tags.forEach((tag) => {
        expect(wrapper.html()).toContain(tag);
      });
    });
  });

  it("should have star as the first tag", async () => {
    wrapper = getWrapper({ posts: baseProps });
    expect(wrapper.vm.OrganizedTags[0]).toBe("★");
  });

  it("should sort the tags correctly by count", async () => {
    wrapper = getWrapper({ posts: [{ tags: ["a"] }, { tags: ["a", "b"] }] });
    expect(wrapper.vm.OrganizedTags[0]).toBe("a");
    expect(wrapper.vm.OrganizedTags[1]).toBe("b");
  });

  it("should sort the tags correctly by count and alway7s place star first", async () => {
    wrapper = getWrapper({
      posts: [{ tags: ["a"] }, { tags: ["a", "b", "★"] }],
    });
    expect(wrapper.vm.OrganizedTags[0]).toBe("★");
    expect(wrapper.vm.OrganizedTags[1]).toBe("a");
    expect(wrapper.vm.OrganizedTags[2]).toBe("b");
  });
});
