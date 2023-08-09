<template>
  <div class="flex px-0 pt-1 sm:pt-4 sm:pr-1">
    <button
      data-tooltip-target="tooltip-default"
      class="tag text-xs sm:text-sm px-3 rounded-2xl active:bg-desaturated-blue py-1 w-36 sm:w-fit group relative inline-block transition duration-150 ease-in-out hover:text-primary-700 focus:text-primary-700 active:text-primary-700"
      :class="tagClass"
      :title="`Click to filter out any post unrelated to ${tag}. Click multiple tags to broaden the filter.`"
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
        : "bg-desaturated-blue hover:bg-cyan-200 ";
      tagClass +=
        this.tag === "★"
          ? "text-amber-300"
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
