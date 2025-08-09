const SUPABASE_URL = 'https://sinrbpcngsprsjjeesxq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpbnJicGNuZ3NwcnNqamVlc3hxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM2MzEyMjksImV4cCI6MjA2OTIwNzIyOX0.GJsfbV1WWy7e3WdpTH6G0chbYnS4qlgT8pm1V5AlhX4';

const { createClient } = window.supabase;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const tableContainer = document.getElementById('tableContainer');
const modal = document.getElementById('modal');
const dataForm = document.getElementById('dataForm');
const modalTitle = document.getElementById('modalTitle');
const pageTitle = document.getElementById('pageTitle');
const sidebarLinks = document.querySelectorAll('.sidebar a');
const addButton = document.getElementById('addButton');
const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('searchButton');
const closeButton = document.querySelector('.close-button');
const prevPageButton = document.getElementById('prevPage');
const nextPageButton = document.getElementById('nextPage');
const pageInfoSpan = document.getElementById('pageInfo');
const manageColumnsButton = document.getElementById('manageColumnsButton');
const columnsModal = document.getElementById('columnsModal');
const closeColumnsModalButton = document.getElementById('closeColumnsModal');
const columnsForm = document.getElementById('columnsForm');
const saveColumnsButton = document.getElementById('saveColumnsButton');
const exportButton = document.getElementById('exportButton');

let currentTable = 'departments';
let currentPage = 0;
const pageSize = 10;

// ترجمة أسماء الأعمدة لتسهيل التعامل معها
const columnTranslations = {
    id: 'المعرّف',
    name: 'الاسم',
    manager_id: 'مدير القسم',
    budget: 'الميزانية',
    location: 'الموقع',
    department_type: 'نوع القسم',
    first_name: 'الاسم الأول',
    last_name: 'الاسم الأخير',
    email: 'البريد الإلكتروني',
    phone: 'الهاتف',
    department_id: 'القسم',
    position: 'المنصب',
    hire_date: 'تاريخ التعيين',
    salary: 'الراتب',
    status: 'الحالة',
    contact_person: 'مسؤول الاتصال',
    address: 'العنوان',
    customer_type: 'نوع العميل',
    description: 'الوصف',
    sku: 'رمز المنتج',
    category_id: 'الفئة',
    capacity: 'السعة'
};

async function fetchData(tableName, searchQuery = '') {
    const from = currentPage * pageSize;
    const to = from + pageSize - 1;
    let query = supabase.from(tableName).select(`*`).range(from, to);
    if (searchQuery) {
        // البحث الآن يتم على أي حقل يحتوي على 'name'
        query = query.ilike('name', `%${searchQuery}%`);
    }
    const { data, error } = await query;
    return { data, error };
}

async function fetchAllData(tableName) {
    const { data, error } = await supabase.from(tableName).select(`*`);
    return { data, error };
}

async function getRecordById(tableName, id) {
    const { data, error } = await supabase.from(tableName).select(`*`).eq('id', id).single();
    return { data, error };
}

async function addData(tableName, record) {
    const { data, error } = await supabase.from(tableName).insert([record]);
    return { data, error };
}

async function updateData(tableName, id, record) {
    const { data, error } = await supabase.from(tableName).update(record).eq('id', id);
    return { data, error };
}

async function deleteData(tableName, id) {
    const { error } = await supabase.from(tableName).delete().eq('id', id);
    return { error };
}

function renderTable(tableName, data) {
    pageTitle.textContent = `إدارة ${tableName}`;
    if (!data || data.length === 0) {
        tableContainer.innerHTML = `<p>لا توجد بيانات لعرضها في جدول ${tableName}.</p>`;
        return;
    }

    // قراءة الأعمدة المراد عرضها من التخزين المحلي
    const savedColumns = JSON.parse(localStorage.getItem(`columns-${tableName}`)) || Object.keys(data[0]);
    const headers = savedColumns.filter(header => Object.keys(data[0]).includes(header));
    
    let tableHtml = `<div class="table-responsive"><table><thead><tr>${headers.map(header => `<th>${columnTranslations[header] || header}</th>`).join('')}<th>الإجراءات</th></tr></thead><tbody>`;
    data.forEach(item => {
        tableHtml += `<tr>${headers.map(header => `<td>${item[header] || ''}</td>`).join('')}<td class="actions"><button class="editButton" data-id="${item.id}" data-table="${tableName}">تعديل</button><button class="deleteButton" data-id="${item.id}" data-table="${tableName}">حذف</button></td></tr>`;
    });
    tableHtml += `</tbody></table></div>`;
    tableContainer.innerHTML = tableHtml;
    attachTableListeners(tableName);
}

function attachTableListeners(tableName) {
    document.querySelectorAll('.editButton').forEach(button => {
        button.addEventListener('click', async (e) => {
            const id = e.target.dataset.id;
            const { data: record } = await getRecordById(tableName, id);
            if (record) openModal(tableName, 'edit', record);
        });
    });
    
    document.querySelectorAll('.deleteButton').forEach(button => {
        button.addEventListener('click', async (e) => {
            const id = e.target.dataset.id;
            if (confirm('هل أنت متأكد من الحذف؟')) {
                const { error } = await deleteData(tableName, id);
                if (error) console.error('Error deleting record:', error.message);
                loadData(currentTable);
            }
        });
    });
}

async function openModal(tableName, mode, record = null) {
    modalTitle.textContent = mode === 'add' ? `إضافة إلى ${tableName}` : `تعديل ${tableName}`;
    const formHtml = await generateFormFields(tableName, record);
    dataForm.innerHTML = formHtml;
    dataForm.dataset.table = tableName;
    dataForm.dataset.mode = mode;
    modal.style.display = 'block';
}

function closeModal() {
    modal.style.display = 'none';
    dataForm.reset();
}

async function generateFormFields(tableName, record = null) {
    const recordId = record ? record.id : '';
    let fields = `<input type="hidden" id="recordId" value="${recordId}">`;

    const [
        employeesData,
        departmentsData,
        customersData,
        suppliersData,
        categoriesData,
        warehousesData
    ] = await Promise.all([
        supabase.from('employees').select('id, first_name, last_name'),
        supabase.from('departments').select('id, name'),
        supabase.from('customers').select('id, name'),
        supabase.from('suppliers').select('id, name'),
        supabase.from('categories').select('id, name'),
        supabase.from('warehouses').select('id, name')
    ]).then(results => results.map(res => res.data));

    const foreignKeys = {
        employees: { data: employeesData },
        departments: { data: departmentsData },
        customers: { data: customersData },
        suppliers: { data: suppliersData },
        categories: { data: categoriesData },
        warehouses: { data: warehousesData }
    };

    switch (tableName) {
        case 'departments':
            fields += `<label>الاسم:</label><input type="text" id="name" value="${record?.name || ''}" required>
                       <label>المدير:</label><select id="manager_id">${foreignKeys.employees.data?.map(e => `<option value="${e.id}" ${e.id === record?.manager_id ? 'selected' : ''}>${e.first_name} ${e.last_name}</option>`).join('') || ''}</select>
                       <label>الميزانية:</label><input type="number" id="budget" value="${record?.budget || ''}">
                       <label>الموقع:</label><input type="text" id="location" value="${record?.location || ''}">
                       <label>نوع القسم:</label><select id="department_type"><option value="إداري" ${record?.department_type === 'إداري' ? 'selected' : ''}>إداري</option><option value="مبيعات" ${record?.department_type === 'مبيعات' ? 'selected' : ''}>مبيعات</option><option value="مشتريات" ${record?.department_type === 'مشتريات' ? 'selected' : ''}>مشتريات</option><option value="مخازن" ${record?.department_type === 'مخازن' ? 'selected' : ''}>مخازن</option><option value="إنتاج" ${record?.department_type === 'إنتاج' ? 'selected' : ''}>إنتاج</option><option value="مالي" ${record?.department_type === 'مالي' ? 'selected' : ''}>مالي</option></select>
                       <button type="submit">${record ? 'تحديث' : 'إضافة'}</button>`;
            break;
        case 'employees':
            fields += `<label>الاسم الأول:</label><input type="text" id="first_name" value="${record?.first_name || ''}" required>
                       <label>الاسم الأخير:</label><input type="text" id="last_name" value="${record?.last_name || ''}" required>
                       <label>البريد الإلكتروني:</label><input type="email" id="email" value="${record?.email || ''}" required>
                       <label>الهاتف:</label><input type="text" id="phone" value="${record?.phone || ''}">
                       <label>القسم:</label><select id="department_id">${foreignKeys.departments.data?.map(d => `<option value="${d.id}" ${d.id === record?.department_id ? 'selected' : ''}>${d.name}</option>`).join('') || ''}</select>
                       <label>المنصب:</label><input type="text" id="position" value="${record?.position || ''}">
                       <label>تاريخ التعيين:</label><input type="date" id="hire_date" value="${record?.hire_date || ''}" required>
                       <label>الراتب:</label><input type="number" id="salary" value="${record?.salary || ''}">
                       <label>الحالة:</label><select id="status"><option value="active" ${record?.status === 'active' ? 'selected' : ''}>Active</option><option value="inactive" ${record?.status === 'inactive' ? 'selected' : ''}>Inactive</option></select>
                       <button type="submit">${record ? 'تحديث' : 'إضافة'}</button>`;
            break;
        case 'warehouses':
            fields += `<label>الاسم:</label><input type="text" id="name" value="${record?.name || ''}" required>
                       <label>الموقع:</label><input type="text" id="location" value="${record?.location || ''}">
                       <label>المدير:</label><select id="manager_id">${foreignKeys.employees.data?.map(e => `<option value="${e.id}" ${e.id === record?.manager_id ? 'selected' : ''}>${e.first_name} ${e.last_name}</option>`).join('') || ''}</select>
                       <label>السعة:</label><input type="number" id="capacity" value="${record?.capacity || ''}">
                       <button type="submit">${record ? 'تحديث' : 'إضافة'}</button>`;
            break;
        case 'suppliers':
            fields += `<label>الاسم:</label><input type="text" id="name" value="${record?.name || ''}" required>
                       <label>مسؤول الاتصال:</label><input type="text" id="contact_person" value="${record?.contact_person || ''}">
                       <label>البريد الإلكتروني:</label><input type="email" id="email" value="${record?.email || ''}">
                       <label>الهاتف:</label><input type="text" id="phone" value="${record?.phone || ''}">
                       <label>العنوان:</label><textarea id="address">${record?.address || ''}</textarea>
                       <button type="submit">${record ? 'تحديث' : 'إضافة'}</button>`;
            break;
        case 'customers':
            fields += `<label>الاسم:</label><input type="text" id="name" value="${record?.name || ''}" required>
                       <label>مسؤول الاتصال:</label><input type="text" id="contact_person" value="${record?.contact_person || ''}">
                       <label>البريد الإلكتروني:</label><input type="email" id="email" value="${record?.email || ''}">
                       <label>الهاتف:</label><input type="text" id="phone" value="${record?.phone || ''}">
                       <label>نوع العميل:</label><select id="customer_type"><option value="جملة" ${record?.customer_type === 'جملة' ? 'selected' : ''}>جملة</option><option value="قطاعي" ${record?.customer_type === 'قطاعي' ? 'selected' : ''}>قطاعي</option><option value="خاص" ${record?.customer_type === 'خاص' ? 'selected' : ''}>خاص</option></select>
                       <button type="submit">${record ? 'تحديث' : 'إضافة'}</button>`;
            break;
        case 'categories':
            fields += `<label>الاسم:</label><input type="text" id="name" value="${record?.name || ''}" required>
                       <label>الوصف:</label><textarea id="description">${record?.description || ''}</textarea>
                       <button type="submit">${record ? 'تحديث' : 'إضافة'}</button>`;
            break;
        case 'products':
            fields += `<label>الاسم:</label><input type="text" id="name" value="${record?.name || ''}" required>
                       <label>SKU:</label><input type="text" id="sku" value="${record?.sku || ''}" required>
                       <label>الوصف:</label><textarea id="description">${record?.description || ''}</textarea>
                       <label>الفئة:</label><select id="category_id">${foreignKeys.categories.data?.map(c => `<option value="${c.id}" ${c.id === record?.category_id ? 'selected' : ''}>${c.name}</option>`).join('') || ''}</select>
                       <button type="submit">${record ? 'تحديث' : 'إضافة'}</button>`;
            break;
        default:
            fields = `<p>لا توجد حقول لهذا الجدول.</p><button type="submit" disabled>إضافة</button>`;
            break;
    }
    return fields;
}

// دالة لفتح نافذة إدارة الأعمدة
async function openColumnsModal() {
    const { data } = await fetchData(currentTable);
    if (!data || data.length === 0) {
        columnsForm.innerHTML = `<p>لا يمكن إدارة الأعمدة لجدول فارغ.</p>`;
        return;
    }

    const allColumns = Object.keys(data[0]);
    const savedColumns = JSON.parse(localStorage.getItem(`columns-${currentTable}`)) || allColumns;

    columnsForm.innerHTML = allColumns.map(column => {
        const isChecked = savedColumns.includes(column) ? 'checked' : '';
        const translatedName = columnTranslations[column] || column;
        return `<label><input type="checkbox" value="${column}" ${isChecked}>${translatedName}</label>`;
    }).join('');

    columnsModal.style.display = 'block';
}

// دالة لحفظ تفضيلات الأعمدة
function saveColumnPreferences() {
    const selectedColumns = Array.from(columnsForm.querySelectorAll('input:checked')).map(input => input.value);
    localStorage.setItem(`columns-${currentTable}`, JSON.stringify(selectedColumns));
    columnsModal.style.display = 'none';
    loadData(currentTable);
}

// دالة لتصدير البيانات إلى ملف CSV
async function exportToCsv() {
    const { data, error } = await fetchAllData(currentTable);
    if (error) {
        alert('حدث خطأ في جلب البيانات للتصدير.');
        return;
    }

    if (!data || data.length === 0) {
        alert('لا توجد بيانات للتصدير.');
        return;
    }

    const savedColumns = JSON.parse(localStorage.getItem(`columns-${currentTable}`)) || Object.keys(data[0]);
    const headers = savedColumns.filter(header => Object.keys(data[0]).includes(header));
    const translatedHeaders = headers.map(h => `"${columnTranslations[h] || h}"`);
    
    let csv = translatedHeaders.join(',') + '\n';
    
    data.forEach(row => {
        const rowData = headers.map(header => {
            const value = row[header];
            // التعامل مع القيم التي تحتوي على فواصل أو علامات اقتباس
            return `"${(value || '').toString().replace(/"/g, '""')}"`;
        });
        csv += rowData.join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${currentTable}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

async function loadData(tableName, searchQuery = '') {
    const { data, error } = await fetchData(tableName, searchQuery);
    if (error) {
        console.error(`Error fetching data for ${tableName}:`, error.message);
        tableContainer.innerHTML = `<p style="color:red;">حدث خطأ أثناء تحميل البيانات: ${error.message}</p>`;
        return;
    }
    renderTable(tableName, data);
    pageInfoSpan.textContent = `صفحة ${currentPage + 1}`;
}

dataForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const tableName = e.target.dataset.table;
    const mode = e.target.dataset.mode;
    const recordId = document.getElementById('recordId').value;
    const record = {};
    for (const element of dataForm.elements) {
        if (element.id && element.id !== 'recordId' && element.value) {
            record[element.id] = element.value;
        }
    }
    let error;
    if (mode === 'add') {
        ({ error } = await addData(tableName, record));
    } else {
        ({ error } = await updateData(tableName, recordId, record));
    }
    if (error) {
        console.error('Error submitting data:', error.message);
        alert(`حدث خطأ: ${error.message}`);
    } else {
        closeModal();
        loadData(currentTable);
    }
});

sidebarLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const tableName = e.target.dataset.table;
        currentTable = tableName;
        currentPage = 0;
        sidebarLinks.forEach(l => l.classList.remove('active'));
        e.target.classList.add('active');
        loadData(tableName);
    });
});

addButton.addEventListener('click', () => openModal(currentTable, 'add'));
searchButton.addEventListener('click', () => loadData(currentTable, searchInput.value));
closeButton.addEventListener('click', closeModal);
window.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

prevPageButton.addEventListener('click', () => {
    if (currentPage > 0) {
        currentPage--;
        loadData(currentTable);
    }
});

nextPageButton.addEventListener('click', () => {
    currentPage++;
    loadData(currentTable);
});

manageColumnsButton.addEventListener('click', openColumnsModal);
closeColumnsModalButton.addEventListener('click', () => columnsModal.style.display = 'none');
saveColumnsButton.addEventListener('click', saveColumnPreferences);
window.addEventListener('click', (e) => { if (e.target === columnsModal) columnsModal.style.display = 'none'; });

exportButton.addEventListener('click', exportToCsv);

document.addEventListener('DOMContentLoaded', () => loadData(currentTable));