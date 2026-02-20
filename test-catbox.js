(async () => {
    const form = new FormData();
    form.append('reqtype', 'fileupload');
    form.append('time', '1h');
    const blob = new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')], { type: 'image/png' });
    form.append('fileToUpload', blob, 'test.png');

    const res = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', { method: 'POST', body: form });
    console.log(res.status, await res.text());
})();
