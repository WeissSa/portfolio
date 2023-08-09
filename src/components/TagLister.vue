<template>
  <div class="flex flex-col xl:w-full w-32 overflow-y-auto overflow-x-hidden">
    <h2 class="text-gray-100 text-2xl text-right mr-2">All Tags</h2>
    <div
      class="flex flex-row flex-wrap scrol h-96 lg:w-32 xl:w-64 2xl:w-84 justify-end"
    >
      <PostTag v-for="tag in OrganizedTags" :key="`tag-${tag}`" :tag="tag" />
    </div>
  </div>
</template>

<script>
import PostTag from "./PostTag.vue";
export default {
  components: { PostTag },
  props: {
    posts: {
      required: true,
      type: Array,
    },
  },
  data() {
    const TagCount = {};

    for (const p of this.posts) {
      for (const tag of p.tags) {
        if (!TagCount[tag]) {
          TagCount[tag] = 0;
        }
        TagCount[tag] = TagCount[tag] + 1;
      }
    }
    console.log(TagCount);
    const OrganizedTags = Object.keys(TagCount);
    OrganizedTags.sort((tag1, tag2) => {
      if (tag1 === "★") {
        return -1;
      } else if (tag2 === "★") {
        return 1;
      }
      return TagCount[tag2] - TagCount[tag1];
    });

    return {
      OrganizedTags,
    };
  },
};
</script>
