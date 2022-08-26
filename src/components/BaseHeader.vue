<template>
  <h1
    class="text-lg sm:text-2xl text-gray-200 py-1 text-center w-screen bg-purple-800"
  >
    {{ text }}:
  </h1>
</template>

<script>
export default {
  props: {
    text: {
      required: true,
      type: String,
    },
  },
};
</script>
