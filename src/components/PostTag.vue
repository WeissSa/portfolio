<template>
  <div class="flex pr-1">
    <button
      class="text-gray-700 text-sm px-3 rounded-2xl hover:bg-blue-100 active:bg-blue-300"
      :class="{
        'bg-blue-300': isCurrentTagInFilter,
        'bg-blue-200': !isCurrentTagInFilter,
      }"
      @click="handleClick"
    >
      {{ tag }}
    </button>
  </div>
</template>

<script>
export default {
  props: {
    tag: {
      required: true,
      type: String,
    },
  },
  computed: {
    isCurrentTagInFilter() {
      return this.$store.state.currentTag === this.tag;
    },
  },
  methods: {
    handleClick() {
      this.isCurrentTagInFilter
        ? this.$store.commit("SET_TAG", null)
        : this.$store.commit("SET_TAG", this.tag);
    },
  },
};
</script>
