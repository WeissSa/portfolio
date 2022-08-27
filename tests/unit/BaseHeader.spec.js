import { shallowMount } from "@vue/test-utils";
import BaseHeader from "../../src/components/BaseHeader";

describe("BaseHeader", () => {
  it("should display the header", () => {
    const wrapper = shallowMount(BaseHeader, {
      propsData: {
        text: "header",
      },
    });
    expect(wrapper.html()).toContain("header:");
  });
});
