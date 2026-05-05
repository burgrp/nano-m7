function formatDuration(durationUSec) {

    const days = Math.floor(durationUSec / (1E6 * 60 * 60 * 24));
    const hours = Math.floor((durationUSec % (1E6 * 60 * 60 * 24)) / (1E6 * 60 * 60));
    const minutes = Math.floor((durationUSec % (1E6 * 60 * 60)) / (1E6 * 60));
    const seconds = Math.floor((durationUSec % (1E6 * 60)) / 1E5) / 10;

    const formattedHours = `${days * 24 + hours}`.padStart(2, '0');
    const formattedMinutes = String(minutes).padStart(2, '0');
    const formattedSeconds = seconds.toFixed(1).padStart(4, '0');

    return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
}

function setText(jq, text) {
    let el = jq.get(0)
    if (el.firstChild && el.firstChild.nodeType == Node.TEXT_NODE) {
        el.firstChild.textContent = text
    } else {
        jq.text(text)
    }
}

export { formatDuration, setText };