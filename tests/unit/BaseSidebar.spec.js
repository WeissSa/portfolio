import { shallowMount } from "@vue/test-utils";
import BaseSidebar, { tabs } from "../../src/components/BaseSidebar";

describe("BaseSidebar", () => {
  let wrapper;
  beforeEach(() => {
    wrapper = shallowMount(BaseSidebar);
  });
  it("should expand and contract when clicking on the expand/contract button", async () => {
    const button = await wrapper.find("#expand-button");

    expect(wrapper.vm.isShowing).toBeTruthy();
    expect(wrapper.find("#sidebar-content").exists()).toBeTruthy();

    await button.trigger("click");

    expect(wrapper.vm.isShowing).toBeFalsy();
    expect(wrapper.find("#sidebar-content").exists()).toBeFalsy();

    await button.trigger("click");

    expect(wrapper.vm.isShowing).toBeTruthy();
    expect(wrapper.find("#sidebar-content").exists()).toBeTruthy();
  });

  it("should change icon when expanded/contracted", async () => {
    expect(wrapper.html()).toContain("←");
    expect(wrapper.html()).not.toContain("→");

    await wrapper.setData({
      isShowing: false,
    });

    expect(wrapper.html()).not.toContain("←");
    expect(wrapper.html()).toContain("→");
  });

  it("should show a link for each desired tab", () => {
    console.log(wrapper.html());
    tabs.forEach((tab) => {
      expect(wrapper.find(`.${tab.name}`).exists()).toBeTruthy();
    });
  });
});
