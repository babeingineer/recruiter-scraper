let payload,
  header = {};
let isPayload = 0,
  isHeader = 0;
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    let decoder = new TextDecoder("utf-8");
    let _payload = JSON.parse(
      decoder.decode(details.requestBody.raw[0].bytes).replaceAll("/", "//")
    );
    if (_payload.operationName == "ProspectsWithPaginationByJobId") {
      console.log(_payload);
      payload = _payload;
      delete payload.variables.bucket;
      delete payload.variables.filters;
      //   payload.variables.pageNumber = 100;
      payload.variables.pageSize = 100;

      isPayload = 1;
      console.log("payload set");
      if (isPayload && isHeader) {
        chrome.runtime.sendMessage({ type: "ready" });
      }
    }
  },
  {
    urls: ["https://id.employer.seek.com/cm-graphql-api/graphql"],
  },
  ["requestBody"]
);

chrome.webRequest.onSendHeaders.addListener(
  (details) => {
    console.log(details);
    for (let h of details.requestHeaders) {
      if (h.name == "x-seek-wide-advertiser-id")
        header["x-seek-wide-advertiser-id"] = h.value;
      else if (h.name == "authorization") header["authorization"] = h.value;
      else if (h.name == "Cookie") header["Cookie"] = h.value;
    }
    isHeader = 1;
    console.log("header set");
    if (isPayload && isHeader) {
      chrome.runtime.sendMessage({ type: "ready" });
    }
  },
  {
    urls: ["https://id.employer.seek.com/cm-graphql-api/graphql"],
  },
  ["requestHeaders", "extraHeaders"]
);

async function scrape(pn) {
  const url = "https://id.employer.seek.com/cm-graphql-api/graphql";
  payload.variables.pageNumber = pn;

  const headers = new Headers();
  headers.append("Authorization", header["authorization"]);
  headers.append("Cookie", header["Cookie"]);
  headers.append("Content-Type", "application/json");
  headers.append("Features", "SearchApi");
  headers.append(
    "X-Seek-Wide-Advertiser-Id",
    header["x-seek-wide-advertiser-id"]
  );

  // Construct request options
  const requestOptions = {
    method: "POST",
    headers: headers,
    body: JSON.stringify(payload),
  };

  // Make the fetch request
  return await fetch(url, requestOptions).then((response) => {
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }
    return response.json();
  });
}
function getCSV(nodes) {
    let res = '"Name"\t"Email"\t"Application questions"\t"Status"\t"Work History"\t"Qualifications"\t"Skills"\t"Licenses and Certifications"\n';
    for (let node of nodes) {
      let name = node.firstName + " " + node.lastName;
      let email = node.email;
      let applicationQuestions = "";
      for (let requirement of node.submission.roleRequirements) {
        let question = requirement.question;
        let answer = "";
        for (let ans of requirement.rrAnswers) {
          answer += ans.text + ",";
        }
        applicationQuestions += question + ":" + answer + "\n";
      }

      let status = node.bucket;

      let workHistory = "";
      for (let item of node.profile.workHistory) {
        workHistory += item.title.text + " - " + item.company.text + "\n";
        workHistory +=
          item.startDate.year +
          "." +
          item.startDate.month +
          "-" +
          (item.endDate
            ? item.endDate.year + "." + item.endDate.month
            : "Present") +
          "\n";
        if (item.achievements) workHistory += item.achievements;
        workHistory += "\n";
      }

      let education = "";
      for (let item of node.profile.education) {
        education += item.name.text + " - " + item.institute.text + "\n";
        if (item.completionDate) education += item.completionDate.year + "\n";
      }

      let skills = "";
      for (let item of node.profile.skills) {
        skills += item.keyword.text += ", ";
      }

      let licenses = "";
      for (let item of node.profile.licences) {
        licenses += item.name.text + "\n";
        if (item.issuingOrganisation)
          licenses += item.issuingOrganisation + "\n";
        licenses += item.formattedExpiryDate + "\n";
        licenses += item.description + "\n";
      }

      res +=
        `"` +
        name.replaceAll(`"`, `""`) +
        `"` +
        "\t" +
        `"` +
        email.replaceAll(`"`, `""`) +
        `"` +
        "\t" +
        `"` +
        applicationQuestions.replaceAll(`"`, `""`) +
        `"` +
        "\t" +
        `"` +
        status.replaceAll(`"`, `""`) +
        `"` +
        "\t" +
        `"` +
        workHistory.replaceAll(`"`, `""`) +
        `"` +
        "\t" +
        `"` +
        education.replaceAll(`"`, `""`) +
        `"` +
        "\t" +
        `"` +
        skills.replaceAll(`"`, `""`) +
        `"` +
        "\t" +
        `"` +
        licenses.replaceAll(`"`, `""`) +
        `"` +
        "\t" +
        "\n";
    }
    return res;
}

chrome.runtime.onMessage.addListener(async (req, sender, res) => {
  if (req.type == "loaded") {
    if (isPayload && isHeader) {
      chrome.runtime.sendMessage({ type: "ready" });
    }
  } else if (req.type == "start") {
    let res = [];
    for (let i = 1; ; ++i) {
      let nodes = (await scrape(i)).data.prospectsWithPaginationByJobId.nodes;
      if (nodes.length == 0) break;

      res = [...res, ...nodes];
    }
    console.log(res);

    chrome.runtime.sendMessage({type: "download", data: getCSV(res)});
  }
});
