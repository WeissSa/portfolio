<template>
  <div class="flex px-0 pt-1 sm:pt-4 sm:pr-1">
    <button
      data-tooltip-target="tooltip-default"
      class="tag text-xs sm:text-sm px-3 rounded-2xl active:bg-violet-300 py-1 w-36 sm:w-fit group relative inline-block"
      :class="tagClass"
      @click="handleClick"
    >
      {{ tag }}
      <span
        class="sm:absolute hidden sm:z-50 sm:group-hover:flex sm:-top-2 sm:-right-3 sm:translate-x-full sm:w-72 sm:px-2 sm:py-1 sm:bg-gray-700 sm:rounded-lg sm:text-center sm:text-white sm:text-sm sm:before:content-[''] sm:before:absolute sm:before:top-1/4 sm:before:right-[100%] sm:before:-translate-y-1/2 sm:before:border-8 sm:before:border-y-transparent sm:before:border-l-transparent sm:before:border-r-gray-700"
        >Click to filter out any post unrelated to {{ tag }}. Click multiple
        tags to broaden the filter.
      </span>
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
        : "bg-violet-400 hover:bg-sky-200 ";
      tagClass +=
        this.tag === "★"
          ? "text-yellow-500"
          : this.isCurrentTagInFilter
          ? "text-gray-200"
          : "text-gray-800";

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
