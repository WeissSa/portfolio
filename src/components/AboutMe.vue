<template>
  <div class="flex flex-col w-screen sm:pl-20">
    <div
      v-for="category in categories"
      :key="category.title"
      class="flex flex-col h-[220] sm:h-auto text-gray-700 pt-2 sm:pt-3 pb-10 sm:pb-20 w-full mx-auto text-center"
      :class="category.colour"
    >
      <h2 class="text-4xl sm:mb-auto whitespace-pre-wrap pl-10 sm:pl-0">
        My {{ category.title }}
      </h2>
      <div class="flex flex-col align-top text-left">
        <p
          v-for="entry in category.entries"
          :key="entry.split(' ').join('-')"
          class="flex text-base sm:text-2xl pl-10 pr-1 sm:pl-2 sm:pr-2 pb-[3.5rem]"
        >
          · {{ entry }}
        </p>
        <img
          :alt="category.picAlt"
          :src="`${publicPath}${category.pic}`"
          class="flex object-cover w-60 h-60 rounded-full mx-auto pb-2"
        />
      </div>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      publicPath: process.env.BASE_URL,
      categories: [
        {
          title: "Experiences",
          entries: [
            "Have gone to camp since from ages 8-16 in Algonquin park which has made me feel connection and safety with the outdoors",
            "Went to high school at the University of Toronto Schools and developed a love of Classical History",
            "Developed a love for Computer Science in grade 10 and began working on a game development project for a year in grade 12",
            "Went to University of Toronto for Computer Science with a minor in Math",
            "Currently I am exploring fields of Computer Science but am particularly interested in software development and AI",
          ],
          pic: "experience.jpg",
          picAlt:
            "Me Standing on a cliff in Algonquin park with my former dog Katie (RIP) (2021)",
          colour: "bg-violet-300",
        },
        {
          title: "Values",
          entries: [
            "Trying to always be honest, but not brutally so",
            "Having integrity in mind when taking any action",
            "Being responsible and taking culpability when I have done something wrong",
            "Maintaining loyalty to my friends and family, especially in times of crisis",
            "Having compassion for those around me, particularly for those who are struggling",
            "Taking failure as a chance for growth instead of collapsing in the face of it",
          ],
          pic: "values.jpg",
          picAlt: "Me Standing in front of a mural (2021)",
          colour: "bg-purple-400",
        },
        {
          title: "Hobbies",
          entries: [
            "Cooking/baking - I enjoy making pies, cakes, cookies, and trying new recipes.I am also proud of my potato and chicken burger recipes",
            "Gaming - Currently I am playing mostly Valorant, but I enjoy all genres and have a soft spot for anything by Nintendo, especially Pokemon",
            "Hiking - As mentioned above, I love nature and enjoy hiking through it",
            "Travelling - Although I have not been able to much since COVID, I greatly enjoy travelling and hopefully will find the time to go somewhere cool in Europe sometime this year (🤞 Italy or Greece)",
          ],
          pic: "hobby.jpg",
          picAlt: "Me playing Valorant at the CNE (2022)",
          colour: "bg-purple-500",
        },
      ],
    };
  },
};
</script>
