import { useState } from 'react';
import { Box, Burger, Image, NavLink, Collapse } from '@mantine/core';
import Link from 'next/link';
import classes from './SideBar.module.css';
import { useIsMobile } from '../lib/helpers';

const SideBar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Box className={classes.mobileSidebar}>
        <Burger
          opened={isOpen}
          onClick={() => setIsOpen((o) => !o)}
          title="Toggle sidebar"
          className={classes.burger}
        />
        <Collapse in={isOpen}>
          <Box>
            <NavLink component={Link} href="/" label="Home" />
            <NavLink
              component={Link}
              href="/climate-change"
              label="Climate Change"
            />
            <Box className={classes.socialLinks}>
              <a
                href="https://github.com/WeissSa"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Image
                  src="/portfolio/GitHub.png"
                  alt="GitHub"
                  width={40}
                  height={40}
                />
              </a>
              <a
                href="https://linkedin.com/in/samuelbsweiss"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Image
                  src="/portfolio/Linkedin.png"
                  alt="LinkedIn"
                  width={40}
                  height={40}
                />
              </a>
            </Box>
          </Box>
        </Collapse>
      </Box>
    );
  }

  return (
    <Box className={classes.sidebar} style={{ width: isOpen ? 150 : 50 }}>
      <Burger
        opened={isOpen}
        onClick={() => setIsOpen((o) => !o)}
        title="Toggle sidebar"
        className={classes.burger}
        pl={12}
      />
      {isOpen && (
        <Box className={classes.sidebarContent}>
          <Image
            src="/portfolio/Profile.png"
            alt="Samuel Weiss"
            width={50}
            height={50}
            className={classes.profileImage}
          />
          <NavLink component={Link} href="/" label="Home" />
          <NavLink
            component={Link}
            href="/climate-change"
            label="Climate Change"
          />
          <Box className={classes.socialLinks}>
            <a
              href="https://github.com/WeissSa"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Image
                src="/portfolio/GitHub.png"
                alt="GitHub"
                width={40}
                height={40}
              />
            </a>
            <a
              href="https://linkedin.com/in/samuelbsweiss"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Image
                src="/portfolio/Linkedin.png"
                alt="LinkedIn"
                width={40}
                height={40}
              />
            </a>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default SideBar;
