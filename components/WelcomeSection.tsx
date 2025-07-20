import { Container, Title, Text, Card } from '@mantine/core';
import React from 'react';
import { ScrollDownArrow } from './ScrollDownArrow';
import classes from './WelcomeSection.module.css';

export function WelcomeSection() {
  return (
    <Container className={classes.welcomeContainer}>
      <Card>
        <Title order={1} ta="center" style={{ fontSize: '4rem' }}>
          Welcome to my Website!
        </Title>
      </Card>

      <Card shadow="sm" p="lg" radius="md">
        <Text size="xl" ta="center" style={{ maxWidth: '800px' }}>
          I&apos;m Sam, a Software Engineer with a Computer Science specialist
          and Math minor from the University of Toronto. I am passionate about
          software engineering and AI. My journey in tech began with game
          development in high school, evolving into a keen interest in building
          robust and intelligent software. I thrive on expanding my skills,
          embracing challenges as opportunities for growth, and taking ownership
          of my work. My projects often involve leveraging cutting-edge
          technologies, including artificial intelligence, to create impactful
          solutions. Beyond coding, I enjoy hiking, gaming, and exploring new
          recipes. I am also learning Japanese in my free time.
        </Text>
      </Card>

      <ScrollDownArrow />
    </Container>
  );
}
