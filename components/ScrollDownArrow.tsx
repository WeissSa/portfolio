import React from 'react';
import { Box } from '@mantine/core';
import { IconChevronDown } from '@tabler/icons-react';
import { motion } from 'framer-motion';

export function ScrollDownArrow() {
  const arrowVariants = {
    animate: {
      y: [0, -10, 0], // Standard bounce up and down
      opacity: [0.8, 1, 0.8], // Pulse at lowest point
      transition: {
        duration: 1.2, // Shorter duration for a snappier bounce
        ease: 'easeOut',
        repeat: Infinity,
        repeatDelay: 0.3,
      },
    },
  };

  return (
    <Box
      style={{
        position: 'absolute',
        bottom: '2rem',
      }}
    >
      <motion.div
        variants={arrowVariants}
        initial={{ y: 0, opacity: 0.8 }} // Initial state for the animation
        animate="animate"
      >
        <IconChevronDown size="3rem" data-testid="scroll-down-icon" />
      </motion.div>
    </Box>
  );
}
