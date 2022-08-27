import { shallowMount } from "@vue/test-utils";
import PostPreview from "../../src/components/PostPreview.vue";

const basicProps = {
  title: "My Post",
  repo: "Github",
  tags: ["tag"],
  description: "desc",
  thumbnail: "png",
};

describe("PostPreview", () => {
  let wrapper, props;
  const getWrapper = () => {
    return shallowMount(PostPreview, {
      data() {
        return {
          isExpanded: false,
          publicPath: "path",
        };
      },
      propsData: props,
      stubs: ["router-link", "PostTag"],
    });
  };
  beforeEach(() => {
    props = { ...basicProps };
  });

  it("should not show the description by default", () => {
    wrapper = getWrapper();
    expect(wrapper.html()).not.toContain(basicProps.description);
  });

  it("should expand/contract on click", async () => {
    wrapper = getWrapper();

    await wrapper.find("button").trigger("click");

    expect(wrapper.html()).toContain(basicProps.description);
    expect(wrapper.html()).toContain("⌃");

    await wrapper.find("button").trigger("click");

    expect(wrapper.html()).not.toContain(basicProps.description);
    expect(wrapper.html()).toContain("⌄");
  });

  it("should not expand when the github button is clicked", async () => {
    wrapper = getWrapper();

    expect(wrapper.vm.isExpanded).toBe(false);

    await wrapper.find("img[alt='github logo']").trigger("click");

    expect(wrapper.vm.isExpanded).toBe(false);
  });

  it("should use an a tag when the link is external", () => {
    wrapper = getWrapper();

    expect(wrapper.find("a").exists()).toBe(true);
    expect(wrapper.find("router-link").exists()).toBe(false);
  });

  it("should use an router-link tag when the link is private", () => {
    props.repo = "/private";
    wrapper = getWrapper();

    expect(wrapper.find("a").exists()).toBe(false);
    expect(wrapper.find("router-link").exists()).toBe(true);
  });

  it("should display the title", () => {
    wrapper = getWrapper();
    expect(wrapper.html()).toContain(basicProps.title);
  });

  it("should display a single tag", () => {
    wrapper = getWrapper();
    expect(wrapper.find("post-tag-stub").exists()).toBe(true);
  });

  it("should display a single tag", () => {
    props.tags.push("tag two");
    wrapper = getWrapper();
    expect(wrapper.findAll("post-tag-stub").length).toBe(2);
  });

  it("should not expand upon clicking a tag", async () => {
    wrapper = getWrapper();

    expect(wrapper.vm.isExpanded).toBe(false);

    await wrapper.find("post-tag-stub").trigger("click");

    expect(wrapper.vm.isExpanded).toBe(false);
  });

  it("should correctly set the src of the image", async () => {
    wrapper = getWrapper();

    await wrapper.setData({
      isExpanded: true,
    });

    expect(wrapper.find("img[src='pathpng']").exists()).toBe(true);
  });
});
