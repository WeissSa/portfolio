import { flushPromises, shallowMount, RouterLinkStub } from "@vue/test-utils";
import BaseSidebar, { tabs } from "../../src/components/BaseSidebar";

describe("BaseSidebar", () => {
  let wrapper;
  beforeEach(() => {
    wrapper = shallowMount(BaseSidebar, {
      stubs: { RouterLink: RouterLinkStub },
    });
  });
  it("should expand and contract when clicking on the expand/contract button with animation", async () => {
    await wrapper.setData({
      isOpen: true,
      isShowing: true,
    });

    jest.useFakeTimers();
    const button = await wrapper.find("#expand-button");

    expect(wrapper.vm.isOpen).toBeTruthy();

    jest.runAllTimers();
    await flushPromises();

    expect(wrapper.vm.isShowing).toBeTruthy();
    expect(wrapper.find("#sidebar-content").exists()).toBeTruthy();

    await button.trigger("click");

    expect(wrapper.vm.isOpen).toBeFalsy();

    jest.runAllTimers();
    await flushPromises();
    expect(wrapper.vm.isShowing).toBeFalsy();
    expect(wrapper.find("#sidebar-content").exists()).toBeFalsy();

    await button.trigger("click");

    expect(wrapper.vm.isOpen).toBeTruthy();

    jest.runAllTimers();
    await flushPromises();

    expect(wrapper.vm.isShowing).toBeTruthy();
    expect(wrapper.find("#sidebar-content").exists()).toBeTruthy();
  });

  it("should change icon when expanded/contracted", async () => {
    expect(wrapper.html()).not.toContain("←");
    expect(wrapper.html()).toContain("→");

    await wrapper.setData({
      isShowing: true,
    });

    expect(wrapper.html()).toContain("←");
    expect(wrapper.html()).not.toContain("→");
  });

  it("should show a link for each desired tab", async () => {
    await wrapper.setData({
      isOpen: true,
      isShowing: true,
    });

    tabs.forEach((tab) => {
      expect(wrapper.find(`.${tab.name}`).exists()).toBeTruthy();
    });
  });
});
