let account_id, app_id;
let cachedFile = null;
let cachedBase64 = null;

// --- Core Functions for UI/Error Management ---

/**
 * Clears all displayed error messages on the form.
 */
function clearErrors() {
  document.querySelectorAll(".error-message").forEach(span => {
    span.textContent = "";
  });
}

/**
 * Displays an error message next to a specific field.
 * @param {string} fieldId - The ID of the error span (e.g., 'tax-registration-number').
 * @param {string} message - The error message to display.
 */
function showError(fieldId, message) {
  const errorSpan = document.getElementById(`error-${fieldId}`);
  if (errorSpan) errorSpan.textContent = message;
}

/**
 * Shows the file upload progress buffer/overlay
 */
function showUploadBuffer() {
  const buffer = document.getElementById("upload-buffer");
  const bar = document.getElementById("upload-progress");
  if (buffer) buffer.classList.remove("hidden");
  if (bar) {
    bar.classList.remove("animate");
    void bar.offsetWidth;
    bar.classList.add("animate");
  }
}

/**
 * Hides the file upload progress buffer/overlay.
 */
function hideUploadBuffer() {
  const buffer = document.getElementById("upload-buffer");
  if (buffer) buffer.classList.add("hidden");
}

/**
 * Closes the embedded widget and reloads the parent CRM window.
 */
async function closeWidget() {
  await ZOHO.CRM.UI.Popup.closeReload().then(console.log);
}

// --- Data Fetching and Caching Logic ---

/**
 * Executes on widget load to fetch initial data.
 * @param {object} entity - The entity object from the PageLoad event.
 */
ZOHO.embeddedApp.on("PageLoad", async (entity) => {
  try {
    const entity_id = entity.EntityId;

    const appResponse = await ZOHO.CRM.API.getRecord({
      Entity: "Applications1",
      approved: "both",
      RecordID: entity_id,
    });

    const applicationData = appResponse.data[0];
    app_id = applicationData.id;
    account_id = applicationData.Account_Name.id;

    ZOHO.CRM.UI.Resize({ height: "90%" }).then(function (data) {
      console.log("Resize result:", data);
    });
  } catch (error) {
    console.error("PageLoad error:", error);
  }
});

/**
 * Reads the selected file into memory (Base64) and performs size validation.
 * @param {Event} event - The file input change event.
 */
async function cacheFileOnChange(event) {
  clearErrors();

  const fileInput = event.target;
  const file = fileInput?.files[0];

  if (!file) return;

  // Show buffer while processing
  showUploadBuffer();

  // File size validation (Max 20MB)
  if (file.size > 10 * 1024 * 1024) {
    showError("corporate-tax-certificate", "File size must not exceed 10MB.");
    cachedFile = null;
    cachedBase64 = null;
    fileInput.value = ""; // Clear the file input
    // Keep buffer visible briefly so user can see the error
    setTimeout(() => {
      hideUploadBuffer();
    }, 1000);
    return;
  }

  try {
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result.split(',')[1];
        resolve(result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    cachedFile = file;
    cachedBase64 = base64;

    // Simulate a delay for better UX and hide buffer on success
    await new Promise((res) => setTimeout(res, 3000));
    hideUploadBuffer();
  } catch (err) {
    console.error("Error caching file:", err);
    hideUploadBuffer();
    showError("corporate-tax-certificate", "Failed to read file.");
  }
}

/**
 * Uploads the cached file (Base64) to the Applications1 record in CRM.
 */
async function uploadFileToCRM() {
  if (!cachedFile || !cachedBase64) {
    throw new Error("No cached file");
  }

  return await ZOHO.CRM.API.attachFile({
    Entity: "Applications1",
    RecordID: app_id,
    File: {
      Name: cachedFile.name,
      Content: cachedBase64,
    },
  });
}

// --- Main Submission Logic ---

/**
 * Handles the form submission event, performing validation and sending data to CRM.
 * @param {Event} event - The form submit event.
 */
async function update_record(event) {
  event.preventDefault();

  clearErrors();
  let hasError = false;

  const submitBtn = document.getElementById("submit_button_id");
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";
  }

  const effectiveDate = document.getElementById("effective-date")?.value;
  const dateOfIssue = document.getElementById("date-of-issue")?.value;
  const ctrDueDate = document.getElementById("ctr-due-date")?.value;
  const taxRegNo = document.getElementById("tax-registration-number")?.value;
  const taxPeriodCt = document.getElementById("tax-period-ct")?.value;
  const ctrFinancialYearEnd = document.getElementById("ctr-financial-year-end-date")?.value;
  const payGiban = document.getElementById("pay-giban")?.value;

  if (!taxRegNo) {
    showError("tax-registration-number", "Tax Registration Number is required.");
    hasError = true;
  }

  if (!taxPeriodCt) {
    showError("tax-period-ct", "Tax Period is required.");
    hasError = true;
  }

  if (!ctrFinancialYearEnd) {
    showError("ctr-financial-year-end-date", "CTR Financial Year End Date is required.");
    hasError = true;
  }

  if (!effectiveDate) {
    showError("effective-date", "Effective Registration Date is required.");
    hasError = true;
  }

  if (!dateOfIssue) {
    showError("date-of-issue", "Date of Issue is required.");
    hasError = true;
  }

  if (!ctrDueDate) {
    showError("ctr-due-date", "CTR Due Date is required.");
    hasError = true;
  }

  if (!cachedFile || !cachedBase64) {
    showError("corporate-tax-certificate", "Please upload the Corporate Tax Certificate.");
    hasError = true;
  }
  if (!payGiban) {
    showError("pay-giban", "Pay (GIBAN) is required.");
    hasError = true;
  }

  if (hasError) {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit";
    }
    return;
  }

  try {
    const subformData = [];

    if (dateOfIssue) {
      subformData.push({ Type_of_Dates: "Date of Issue", Date: dateOfIssue });
    }

    if (effectiveDate) {
      subformData.push({ Type_of_Dates: "Effective Date of Registration", Date: effectiveDate });
    }

    if (ctrDueDate) {
      subformData.push({ Type_of_Dates: "CTR Due Date", Date: ctrDueDate });
    }

    if (ctrFinancialYearEnd) {
      subformData.push({ Type_of_Dates: "CTR Financial Year End Date", Date: ctrFinancialYearEnd });
    }

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

    await ZOHO.CRM.API.updateRecord({
      Entity: "Accounts",
      APIData: {
        id: account_id,
        Effective_Registration_Date_CT: effectiveDate,
        CT_Return_DD: ctrDueDate,
        Tax_Period_CT: taxPeriodCt,
        CT_Pay_GIBAN: payGiban,
        Corporate_Tax_TRN: taxRegNo,
        CT_Status: "Active"
      }
    });

    await uploadFileToCRM();
    await ZOHO.CRM.BLUEPRINT.proceed();
    await ZOHO.CRM.UI.Popup.closeReload();

  } catch (error) {
    console.error("Error on final submit:", error);
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit";
    }
  }
}

// --- Event Listeners and Initialization ---

/**
 * Auto-populates the financial year end date.
 */
function autoPopulateFinancialYearEndDate() {
  const ctrDueDateInput = document.getElementById("ctr-due-date");
  const financialYearEndInput = document.getElementById("ctr-financial-year-end-date");

  ctrDueDateInput.addEventListener("change", () => {
    const dueDateValue = ctrDueDateInput.value;
    if (!dueDateValue) return;

    const dueDate = new Date(dueDateValue);
    const targetMonth = dueDate.getMonth() - 9;
    const targetYear = dueDate.getFullYear();

    const adjustedDate = new Date(targetYear, targetMonth, 1);
    const lastDay = new Date(adjustedDate.getFullYear(), adjustedDate.getMonth() + 1, 0);

    const yyyy = lastDay.getFullYear();
    const mm = String(lastDay.getMonth() + 1).padStart(2, '0');
    const dd = String(lastDay.getDate()).padStart(2, '0');

    financialYearEndInput.value = `${yyyy}-${mm}-${dd}`;
  });
}

// Listener for file input change to cache the file
document.getElementById("corporate-tax-certificate").addEventListener("change", cacheFileOnChange);

// Listener for form submission to trigger validation and update logic
document.getElementById("record-form").addEventListener("submit", update_record);

// Initialize auto-population
autoPopulateFinancialYearEndDate();

// Initialize the Zoho Embedded App
ZOHO.embeddedApp.init();