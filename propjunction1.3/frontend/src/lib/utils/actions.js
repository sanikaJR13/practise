export function downloadJsonFile(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8'
  });
  downloadBlobFile(filename, blob);
}

export function downloadBlobFile(filename, blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function inferDownloadFileName(response, fallbackName = 'download') {
  return response?.fileName ?? fallbackName;
}

export function downloadApiFile(response, fallbackName = 'download') {
  if (!response?.blob) {
    throw new Error('No file payload was returned by the backend.');
  }

  downloadBlobFile(inferDownloadFileName(response, fallbackName), response.blob);
}

export async function shareCurrentPage(title) {
  const sharePayload = {
    title,
    url: window.location.href
  };

  if (navigator.share) {
    await navigator.share(sharePayload);
    return;
  }

  await navigator.clipboard.writeText(window.location.href);
}

export function printCurrentPage() {
  window.print();
}
