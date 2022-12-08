import { shallowMount } from "@vue/test-utils";
import PostTag from "../../src/components/PostTag.vue";
import Vuex from "vuex";

const propsData = {
  tag: "Godot",
};

describe("PostTag", () => {
  let wrapper;
  const mutations = {
    ADD_TAG(state, tag) {
      state.currentTags.push(tag);
    },
    REMOVE_TAG(state, tag) {
      state.currentTags = state.currentTags.filter((t) => t !== tag);
    },
  };
  let store = Vuex.createStore({
    state: {
      currentTags: [],
    },
    mutations,
  });
  const getWrapper = () =>
    shallowMount(PostTag, {
      global: {
        plugins: [store],
      },
      propsData,
    });

  it("should display the tag name", () => {
    wrapper = getWrapper();
    expect(wrapper.find(".tag").text()).toContain(propsData.tag);
  });

  it("should set the text colour to yellow if the test is a star", () => {
    propsData.tag = "★";
    wrapper = getWrapper();
    expect(wrapper.find(".tag").classes()).toContain("text-amber-300");
    propsData.tag = "Godot";
  });

  it("should set the text and bg colour to gray/light gray if the tag is in the filter", () => {
    store.commit("ADD_TAG", "Godot");
    wrapper = getWrapper();
    expect(wrapper.find(".tag").classes()).toContain("bg-gray-700");
    expect(wrapper.find(".tag").classes()).toContain("text-gray-200");
  });

  it("should set the text and bg colour to light blue/dark gray if the tag is not in the filter", () => {
    store.commit("REMOVE_TAG", "Godot");
    wrapper = getWrapper();
    expect(wrapper.find(".tag").classes()).toContain("bg-desaturated-blue");
    expect(wrapper.find(".tag").classes()).toContain("text-gray-800");
  });

  it("should add/remove a tag on click", async () => {
    const mockMutations = {
      ADD_TAG: jest.fn(),
      REMOVE_TAG: jest.fn(),
    };
    store = Vuex.createStore({
      state: {
        currentTags: [],
      },
      mutations: { ...mockMutations },
    });
    wrapper = getWrapper();

    await wrapper.find(".tag").trigger("click");

    expect(mockMutations.ADD_TAG).toHaveBeenCalledWith(
      expect.any(Object),
      propsData.tag
    );

    store.state.currentTags.push("Godot");

    await wrapper.find(".tag").trigger("click");

    expect(mockMutations.REMOVE_TAG).toHaveBeenCalledWith(
      expect.any(Object),
      propsData.tag
    );
  });
});
