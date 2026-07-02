import React from 'react';
import './SearchBar.css';

function SearchBar({ value, onChange, placeholder = "Search for a car..." }) {
  return (
    <div className="search-wrapper">
      <div className="search-input-container">
        <span className="search-icon"></span>
        <input
          type="text"
          className="search-input"
          placeholder={placeholder}
          value={value} 
          onChange={(e) => onChange(e.target.value)} 
        />
      </div>
    </div>
  );
}

export default SearchBar;