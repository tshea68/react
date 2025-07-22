import React from "react";

const Header = () => {
  console.log("✅ Header rendered");
  return (
    <header className="bg-blue-700 text-white p-4 shadow-md">
      <div className="max-w-screen-xl mx-auto flex justify-between items-center">
        <h1 className="text-xl font-semibold">Parts Lookup</h1>
        <nav className="space-x-4">
          <a href="/" className="hover:underline">Home</a>
        </nav>
      </div>
    </header>
  );
};

export default Header;

