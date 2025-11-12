let input = document.querySelector('#firstfile')
input.addEventListener('click', () => {
    input.value = null;
});
input.addEventListener('change', () => {
	let files = input.files;
	if (files.length == 0) return;
	const file = files[0];
	let reader = new FileReader();
	reader.onload = (e) => {
		const file = e.target.result;
        mv.editor().setValue(file);
	};
	reader.onerror = (e) => alert(e.target.error.name);
	reader.readAsText(file);
});

let input2 = document.querySelector('#secondfile')
input2.addEventListener('click', () => {
    input2.value = null;
});
input2.addEventListener('change', () => {
	let files = input2.files;
	if (files.length == 0) return;
	const file = files[0];
	let reader = new FileReader();
	reader.onload = (e) => {
		const file = e.target.result;
        mv.rightOriginal().setValue(file);
	};
	reader.onerror = (e) => alert(e.target.error.name);
	reader.readAsText(file);
});

let fullscreen = document.getElementById('container');
let button = document.getElementById('fs');
button.addEventListener("click", () => {
  if (!document.fullscreenElement) {
    fullscreen?.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
});

// Create Wrap Text button
var wrapCheckbox = document.getElementById('wrapCheckbox');
wrapCheckbox.addEventListener('change', function() {
    // Toggle lineWrapping option for both editors
    var leftEditor = mv.editor();
    var rightEditor = mv.rightOriginal();

    var isLeftWrapping = leftEditor.getOption('lineWrapping');
    var isRightWrapping = rightEditor.getOption('lineWrapping');

    leftEditor.setOption('lineWrapping', !isLeftWrapping);
    rightEditor.setOption('lineWrapping', !isRightWrapping);
});