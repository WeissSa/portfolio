import { Container, Title, Text } from '@mantine/core';
import React from 'react';

export function WelcomeSection() {
  return (
    <Container
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        scrollSnapAlign: 'start',
      }}
    >
      <Title order={1} align="center" style={{ fontSize: '4rem', marginBottom: '2rem' }}>
        Welcome to my Website!
      </Title>
      <Text size="xl" align="center" style={{ maxWidth: '800px' }}>
        I&apos;m Sam, a Computer Science specialist and Math minor at the University of Toronto, passionate about software engineering and AI. My journey in tech began with game development in high school, evolving into a keen interest in building robust and intelligent systems. I thrive on expanding my skills, embracing challenges as opportunities for growth, and taking ownership of my work. My projects often involve leveraging cutting-edge technologies, including artificial intelligence, to create impactful solutions. Beyond coding, I enjoy hiking, gaming, and exploring new recipes. Connect with me on <a href="https://linkedin.com/in/samuelbsweiss" target="_blank" rel="noopener noreferrer">LinkedIn</a> to learn more about my work and experiences.
      </Text>
    </Container>
  );
}
