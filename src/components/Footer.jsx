// src/components/Footer.jsx
import React from "react";

const Footer = () => (
  <footer className="bg-blue-700 text-white text-sm p-4 text-center">
    <div className="max-w-screen-xl mx-auto">
      &copy; {new Date().getFullYear()} Parts Lookup. All rights reserved.
    </div>
  </footer>
);

export default Footer;
