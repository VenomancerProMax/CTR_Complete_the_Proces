let account_id, app_id;
let cachedFile = null;
let cachedBase64 = null;

const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("corporate-tax-certificate");

function showModal(type, title, message) {
  const modal = document.getElementById("custom-modal");
  const iconSuccess = document.getElementById("modal-icon-success");
  const iconError = document.getElementById("modal-icon-error");
  const modalBtn = document.getElementById("modal-close");
  
  document.getElementById("modal-title").textContent = title;
  document.getElementById("modal-message").textContent = message;
  
  modalBtn.onclick = closeModal;

  if (type === "success") { 
    iconSuccess.classList.remove("hidden"); 
    iconError.classList.add("hidden");
    
    modalBtn.onclick = async () => {
      modalBtn.disabled = true;
      modalBtn.textContent = "Finalizing...";
      try {
        await ZOHO.CRM.BLUEPRINT.proceed();
        setTimeout(() => {
          window.top.location.href = window.top.location.href;
        }, 800);
      } catch (e) {
        console.error("Blueprint error", e);
        ZOHO.CRM.UI.Popup.closeReload();
      }
    };
  } else { 
    iconSuccess.classList.add("hidden"); 
    iconError.classList.remove("hidden"); 
  }
  
  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

function closeModal() {
  const modal = document.getElementById("custom-modal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}

function clearErrors() { document.querySelectorAll(".error-message").forEach(span => span.textContent = ""); }
function showError(fieldId, message) { const errorSpan = document.getElementById(`error-${fieldId}`); if (errorSpan) errorSpan.textContent = message; }

function showUploadBuffer(message = "Processing...") {
  const buffer = document.getElementById("upload-buffer");
  document.getElementById("upload-title").textContent = message;
  buffer.classList.remove("hidden");
}

function hideUploadBuffer() { document.getElementById("upload-buffer").classList.add("hidden"); }

async function closeWidget() { await ZOHO.CRM.UI.Popup.closeReload().catch(err => console.error(err)); }

ZOHO.embeddedApp.on("PageLoad", async (entity) => {
  try {
    const appResponse = await ZOHO.CRM.API.getRecord({ Entity: "Applications1", RecordID: entity.EntityId });
    const appData = appResponse.data[0];
    app_id = appData.id;
    account_id = appData.Account_Name?.id || "";
    ZOHO.CRM.UI.Resize({ height: "90%" });
  } catch (err) { console.error(err); }
});

async function handleFile(file) {
  clearErrors();
  const display = document.getElementById("file-name-display");
  if (!file) { cachedFile = null; cachedBase64 = null; display.textContent = "Click or drag & drop"; return; }
  
  if (file.size > 20 * 1024 * 1024) { 
    showModal("error", "File Too Large", "Max size is 20MB.");
    return; 
  }
  
  display.textContent = `File: ${file.name}`;
  
  try {
    const content = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsArrayBuffer(file);
    });
    cachedFile = file;
    cachedBase64 = content;
  } catch (err) { 
    showModal("error", "Error", "Failed to read file."); 
  }
}

fileInput.addEventListener("change", (e) => handleFile(e.target.files[0]));

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("dragover");
});

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  const files = e.dataTransfer.files;
  if (files.length) {
    fileInput.files = files; 
    handleFile(files[0]);
  }
});

async function update_record(event) {
  event.preventDefault();
  clearErrors();
  const btn = document.getElementById("submit_button_id");
  
  const taxRegNo = document.getElementById("tax-registration-number").value.trim();
  const taxPeriodCt = document.getElementById("tax-period-ct").value;
  const effectiveDate = document.getElementById("effective-date").value;
  const dateOfIssue = document.getElementById("date-of-issue").value;
  const ctrDueDate = document.getElementById("ctr-due-date").value;
  const ctrFinancialYearEnd = document.getElementById("ctr-financial-year-end-date").value;
  const payGiban = document.getElementById("pay-giban").value.trim();
  
  if (!taxRegNo || !taxPeriodCt || !effectiveDate || !dateOfIssue || !ctrDueDate || !ctrFinancialYearEnd || !payGiban || !cachedFile) {
    if(!taxRegNo) showError("tax-registration-number", "Required");
    if(!taxPeriodCt) showError("tax-period-ct", "Required");
    if(!effectiveDate) showError("effective-date", "Required");
    if(!dateOfIssue) showError("date-of-issue", "Required");
    if(!ctrDueDate) showError("ctr-due-date", "Required");
    if(!ctrFinancialYearEnd) showError("ctr-financial-year-end-date", "Required");
    if(!payGiban) showError("pay-giban", "Required");
    if(!cachedFile) showError("corporate-tax-certificate", "Upload required");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Updating...";
  showUploadBuffer("Submitting...");

  try {
    const subformData = [
      { Type_of_Dates: "Date of Issue", Date: dateOfIssue },
      { Type_of_Dates: "Effective Date of Registration", Date: effectiveDate },
      { Type_of_Dates: "CTR Due Date", Date: ctrDueDate },
      { Type_of_Dates: "CTR Financial Year End Date", Date: ctrFinancialYearEnd }
    ];

    await ZOHO.CRM.API.updateRecord({
      Entity: "Applications1",
      APIData: {
        id: app_id,
        Tax_Registration_Number_TRN: taxRegNo,
        Tax_Period_CT: taxPeriodCt,
        Subform_2: subformData,
        Pay_GIBAN: payGiban,
        Application_Issuance_Date: dateOfIssue
      }
    });
    
    await ZOHO.CRM.FUNCTIONS.execute("ta_ctr_complete_the_process_update_account", {
      arguments: JSON.stringify({
        account_id: account_id,
        effective_date: effectiveDate,
        ctr_due_date: ctrDueDate,
        tax_period_ct: taxPeriodCt,
        pay_giban: payGiban,
        corporate_tax_trn: taxRegNo
      })
    });
    
    await ZOHO.CRM.API.attachFile({ 
        Entity: "Applications1", 
        RecordID: app_id, 
        File: { Name: cachedFile.name, Content: cachedBase64 } 
    });
    
    hideUploadBuffer();
    showModal("success", "Success!", "Record updated. Click Ok to reload.");
  } catch (err) {
    btn.disabled = false;
    btn.textContent = "Submit";
    hideUploadBuffer();
    showModal("error", "Failed", "Check connection and try again.");
  }
}

function autoPopulateFinancialYearEndDate() {
  const ctrDueDateInput = document.getElementById("ctr-due-date");
  const financialYearEndInput = document.getElementById("ctr-financial-year-end-date");
  ctrDueDateInput.addEventListener("change", () => {
    const dueDateValue = ctrDueDateInput.value;
    if (!dueDateValue) return;
    const dueDate = new Date(dueDateValue);
    const fyeDate = new Date(dueDate.getFullYear(), dueDate.getMonth() - 9 + 1, 0); 
    const yyyy = fyeDate.getFullYear();
    const mm = String(fyeDate.getMonth() + 1).padStart(2, '0');
    const dd = String(fyeDate.getDate()).padStart(2, '0');
    financialYearEndInput.value = `${yyyy}-${mm}-${dd}`;
  });
}

document.getElementById("record-form").addEventListener("submit", update_record);
autoPopulateFinancialYearEndDate();
ZOHO.embeddedApp.init();