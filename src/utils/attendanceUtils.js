// backend/src/utils/attendanceUtils.js
const calculateAttendanceStats = (records) => {
    const stats = {
        total: records.length,
        present: 0,
        absent: 0,
        late: 0,
        excused: 0
    };

    records.forEach(record => {
        stats[record.status.toLowerCase()]++;
    });

    stats.attendanceRate = ((stats.present + stats.late * 0.5) / stats.total) * 100;

    return stats;
};

const generateAttendanceReport = (records, format = 'pdf') => {
    // Logique de génération de rapport à implémenter selon le format
};

const validateAttendanceData = (data) => {
    const errors = [];
    
    if (!data.student) errors.push('Student ID is required');
    if (!data.course) errors.push('Course ID is required');
    if (!data.date) errors.push('Date is required');
    if (data.status && !['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'].includes(data.status)) {
        errors.push('Invalid status');
    }

    return errors;
};

module.exports = {
    calculateAttendanceStats,
    generateAttendanceReport,
    validateAttendanceData
};