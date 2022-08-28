<template>
  <div class="flex px-0 pt-1 sm:pt-4 sm:pr-1">
    <button
      data-tooltip-target="tooltip-default"
      class="tag text-xs sm:text-sm px-3 rounded-2xl active:bg-blue-300 py-1 w-36 sm:w-fit group relative inline-block"
      :class="tagClass"
      @click="handleClick"
    >
      {{ tag }}
      <span
        class="absolute hidden group-hover:flex -top-2 -right-3 translate-x-full w-48 px-2 py-1 bg-gray-700 rounded-lg text-center text-white text-sm before:content-[''] before:absolute before:top-1/4 before:right-[100%] before:-translate-y-1/2 before:border-8 before:border-y-transparent before:border-l-transparent before:border-r-gray-700"
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
