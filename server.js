const { exec } = require('child_process');

const PORT = 8000; // Change port if needed

exec(`python3 -m http.server ${PORT}`, (error, stdout, stderr) => {
    if (error) {
        console.error(`Error starting Python HTTP server: ${error.message}`);
        return;
    }
    if (stderr) {
        console.error(`Python HTTP server stderr: ${stderr}`);
        return;
    }
    console.log(`Python HTTP server started on port ${PORT}`);
});