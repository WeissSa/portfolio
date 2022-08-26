<template>
  <div class="flex flex-col-reverse mx-auto gap-y-4">
    <PostPreview
      v-for="post in filteredPosts"
      :key="post.title"
      :title="post.title"
      :description="post.description"
      :repo="post.repo"
      :tags="post.tags"
      :thumbnail="post.image"
    />
  </div>
</template>

<script>
import posts from "../assets/posts.json";

import PostPreview from "./PostPreview.vue";

export default {
  components: {
    PostPreview,
  },
  data() {
    return { posts };
  },
  computed: {
    filteredPosts() {
      return posts.filter(
        (post) =>
          this.$store.state.currentTag === null ||
          post.tags.includes(this.$store.state.currentTag)
      );
    },
  },
};
</script>
