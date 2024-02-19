let downloading = 0;
document.addEventListener("DOMContentLoaded", function () {
    chrome.runtime.sendMessage({type:"loaded"});
    chrome.runtime.onMessage.addListener(async (req, sender, res) => {
        if(req.type == "ready") {
            if(downloading == 0)
                document.getElementById("scrape").disabled = false;
        }
        else if(req.type == "download") {
            const csvContent = req.data;
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'data.csv';
            a.click();
            URL.revokeObjectURL(a.href);
            downloading = 0;
            document.getElementById("scrape").innerText = "Scrape";
        }
    })
});
document.getElementById("scrape").onclick = function() {
    chrome.runtime.sendMessage({type:"start"});
    document.getElementById("scrape").disabled = true;
    document.getElementById("scrape").innerText = "downloading";
    downloading = 1;
}