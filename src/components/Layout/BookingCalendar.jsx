import React, { useState } from 'react';
import './BookingCalendar.css';

const BookingCalendar = ({ onDateSelect, savedStartDate, savedDays }) => {
    const parseSavedDate = (dateStr) => {
        if (!dateStr) return null;
        const [year, month, day] = dateStr.split('-').map(Number);
        return new Date(year, month - 1, day);
    };
    const [startDate, setStartDate] = useState(() => parseSavedDate(savedStartDate));
    const [endDate, setEndDate] = useState(() => {
        const start = parseSavedDate(savedStartDate);
        if (!start || !savedDays || savedDays <= 1) return null;
        
        const end = new Date(start);
        end.setDate(start.getDate() + (savedDays - 1));
        return end;
    });
    const [hoverDate, setHoverDate] = useState(null);
    const [currentMonth, setCurrentMonth] = useState(() => {
        const start = parseSavedDate(savedStartDate);
        return start ? new Date(start.getFullYear(), start.getMonth(), 1) : new Date();
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

    const handleDateClick = (day) => {
        const selected = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        if (selected < today) return;

        if (!startDate || (startDate && endDate)) {
            setStartDate(selected);
            setEndDate(null);
            onDateSelect({ start: selected, end: null });
        } else if (selected > startDate) {
            setEndDate(selected);
            setHoverDate(null);
            onDateSelect({ start: startDate, end: selected });
        } else {
            setStartDate(selected);
            setEndDate(null);
            onDateSelect({ start: selected, end: null });
        }
    };

    const handleMouseEnter = (day) => {
        if (startDate && !endDate) {
            const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
            if (date > startDate) setHoverDate(date);
        }
    };

    const clearSelection = () => {
        setStartDate(null);
        setEndDate(null);
        setHoverDate(null);
        onDateSelect({ start: null, end: null });
    };

    const changeMonth = (offset) => {
        const newMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1);
        const currentSystemMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        if (newMonth < currentSystemMonth) return;
        setCurrentMonth(newMonth);
    };

    const renderHeader = () => {
        const monthNames = ["January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"];
        const isPrevDisabled = currentMonth.getMonth() === today.getMonth() && 
                               currentMonth.getFullYear() === today.getFullYear();

        return (
            <div className="calendar-header">
                <div className="nav-controls">
                    <button onClick={() => changeMonth(-1)} disabled={isPrevDisabled} className="nav-btn">&lt;</button>
                    <span className="month-display">{monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}</span>
                    <button onClick={() => changeMonth(1)} className="nav-btn">&gt;</button>
                </div>
                <button className="today-btn" onClick={() => setCurrentMonth(new Date())}>Today</button>
            </div>
        );
    };

    const renderDays = () => {
        const totalDays = daysInMonth(currentMonth.getFullYear(), currentMonth.getMonth());
        const startDay = firstDayOfMonth(currentMonth.getFullYear(), currentMonth.getMonth());
        const days = [];

        for (let i = 0; i < startDay; i++) {
            days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
        }

        for (let d = 1; d <= totalDays; d++) {
            const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d);
            let className = "calendar-day";
            
            if (date < today) {
                className += " past-date"; 
            } else {
                if (startDate && date.getTime() === startDate.getTime()) className += " selected-start";
                if (endDate && date.getTime() === endDate.getTime()) className += " selected-end";
                
                const isHoverRange = startDate && !endDate && hoverDate && date > startDate && date <= hoverDate;
                const isSelectedRange = startDate && endDate && date > startDate && date < endDate;
                
                if (isSelectedRange || isHoverRange) className += " in-range";
                if (isHoverRange && date.getTime() === hoverDate.getTime()) className += " hover-end";
            }

            days.push(
                <div 
                    key={d} 
                    className={className} 
                    onClick={() => handleDateClick(d)}
                    onMouseEnter={() => handleMouseEnter(d)}
                >
                    {date < today ? "" : d}
                </div>
            );
        }
        return days;
    };

    return (
        <div className="booking-calendar-container" onMouseLeave={() => setHoverDate(null)}>
            {renderHeader()}
            <div className="calendar-weekdays">
                <div>S</div><div>M</div><div>T</div><div>W</div><div>T</div><div>F</div><div>S</div>
            </div>
            <div className="calendar-grid">
                {renderDays()}
            </div>
            <div className="selection-status">
                <div className="status-info">
                    {startDate && <p><span>Pickup:</span> {startDate.toLocaleDateString()}</p>}
                    {endDate && <p><span>Return:</span> {endDate.toLocaleDateString()}</p>}
                    {!startDate && <p className="hint-text">Select your pickup date</p>}
                    {startDate && !endDate && <p className="hint-text">Select return date</p>}
                </div>
                {(startDate || endDate) && (
                    <button type="button" className="clear-btn" onClick={clearSelection}>Reset</button>
                )}
            </div>
        </div>
    );
};

export default BookingCalendar;