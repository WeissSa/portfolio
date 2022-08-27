<template>
  <div class="flex px-0 pt-1 sm:pt-4 sm:pr-1">
    <button
      class="text-xs sm:text-sm px-3 rounded-2xl active:bg-blue-300 py-1 w-36 sm:w-fit"
      :class="tagClass"
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
      return this.$store.state.currentTags.includes(this.tag);
    },
    tagClass() {
      let tagClass = "";

      tagClass += this.isCurrentTagInFilter
        ? "bg-gray-700 hover:bg-gray-600 "
        : "bg-blue-200 hover:bg-blue-100 ";
      tagClass +=
        this.tag === "★"
          ? "text-yellow-500"
          : this.isCurrentTagInFilter
          ? "text-gray-200"
          : "text-gray-700";

      return tagClass;
    },
  },
  methods: {
    handleClick() {
      this.isCurrentTagInFilter
        ? this.$store.commit("REMOVE_TAG", this.tag)
        : this.$store.commit("ADD_TAG", this.tag);
    },
  },
};
</script>
