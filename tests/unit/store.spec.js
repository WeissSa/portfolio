import store from '../../src/store';

describe('store', () => {
  it('should default currentTags to an empty list', () => {
    expect(store.state.currentTags).toEqual([]);
  });

  it('should add a tag', () => {
    store.commit('ADD_TAG', 'tag');
    expect(store.state.currentTags).toEqual(['tag']);
  });

  it('should remove a tag', () => {
    store.commit('REMOVE_TAG', 'tag');
    expect(store.state.currentTags).toEqual([]);
  });
});
