import { shallowMount } from '@vue/test-utils';
import AboutMe from '../../src/components/AboutMe.vue';

const mockData = [
  {
    title: 'Mock',
    entries: ['Data 1', 'Data 2'],
    pic: 'pic',
    picAlt: 'picalt',
    colour: 'bg-violet-300',
  },
  {
    title: 'mock 2',
  },
];

const publicPath = 'path';

describe('About Me', () => {
  let wrapper;

  const getWrapper = () => {
    return shallowMount(AboutMe, {
      data() {
        return {
          categories: mockData,
          publicPath,
        };
      },
    });
  };

  it('should display each category', () => {
    expect.assertions(2);
    wrapper = getWrapper();
    mockData.forEach((data) => {
      expect(wrapper.html()).toContain(data.title);
    });
  });

  it('should an entry for each entry', () => {
    expect.assertions(2);
    wrapper = getWrapper();
    mockData[0].entries.forEach((entry) => {
      expect(wrapper.html()).toContain(entry);
    });
  });

  it('should display the picture', () => {
    wrapper = getWrapper();
    expect(wrapper.find("img[alt='picalt']").exists()).toBe(true);
    expect(wrapper.find("img[src='pathpic']").exists()).toBe(true);
  });
});
