/**
 * LoomHR relational schema (MySQL). Scalar fields are columns; nested/array
 * fields (documents, salary history, health, statement snapshot, leave
 * balances, per-week attendance) are stored as JSON for a pragmatic mapping
 * of the existing app model.
 *
 * `SCHEMA` is an ordered list of idempotent CREATE TABLE statements used by
 * the migrate script and the /api/migrate route.
 */

export const SCHEMA: string[] = [
  `CREATE TABLE IF NOT EXISTS employees (
    id            VARCHAR(16) PRIMARY KEY,
    salutation    VARCHAR(8),
    name          VARCHAR(120) NOT NULL,
    father_name   VARCHAR(120),
    gender        VARCHAR(8),
    dob           VARCHAR(12),
    blood_group   VARCHAR(8),
    role          VARCHAR(80),
    department    VARCHAR(80),
    section       VARCHAR(80),
    grade         VARCHAR(16),
    reports_to    VARCHAR(80),
    employment_type VARCHAR(16),
    status        VARCHAR(16),
    doj           VARCHAR(12),
    prev_exp_years INT DEFAULT 0,
    prev_exp_detail VARCHAR(255),
    phone         VARCHAR(32),
    alt_phone     VARCHAR(32),
    email         VARCHAR(120),
    address       TEXT,
    temporary_address TEXT,
    unit          VARCHAR(80),
    location      VARCHAR(120),
    accommodation VARCHAR(40),
    emergency_contact VARCHAR(120),
    emergency_phone VARCHAR(32),
    qualification VARCHAR(120),
    institution   VARCHAR(120),
    pass_year     INT DEFAULT 0,
    aadhaar       VARCHAR(24),
    pan           VARCHAR(16),
    uan           VARCHAR(24),
    esi_no        VARCHAR(24),
    monthly_gross INT DEFAULT 0,
    ctc           INT DEFAULT 0,
    wage_type     VARCHAR(10),
    category      VARCHAR(20),
    category_other VARCHAR(60),
    shift_id      VARCHAR(8),
    salary_per_day INT NULL,
    agent_id      VARCHAR(12) NULL,
    referred_by   VARCHAR(120),
    exit_record   JSON,
    rejoins       JSON,
    conduct       VARCHAR(20),
    pf_applicable TINYINT(1) DEFAULT 1,
    tds_applicable TINYINT(1) DEFAULT 0,
    salary_status VARCHAR(12) DEFAULT 'Paid',
    salary_status_reason VARCHAR(255),
    token_no      VARCHAR(16),
    dept_code     VARCHAR(24),
    pf_code       VARCHAR(40),
    bank_name     VARCHAR(80),
    bank_branch   VARCHAR(80),
    bank_account  VARCHAR(40),
    bank_ifsc     VARCHAR(20),
    statement     JSON,
    health        JSON,
    training      JSON,
    documents     JSON,
    salary_history JSON,
    bank_history  JSON,
    leave_bal     JSON,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX (category), INDEX (wage_type), INDEX (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS attendance (
    emp_id          VARCHAR(16) NOT NULL,
    month           VARCHAR(7) NOT NULL,
    days_worked     INT DEFAULT 0,
    saturdays_worked INT DEFAULT 0,
    total_saturdays INT DEFAULT 4,
    absent          INT DEFAULT 0,
    leaves          INT DEFAULT 0,
    lop             INT DEFAULT 0,
    ot_hours        INT DEFAULT 0,
    week_days_worked JSON,
    week_shift_ids  JSON,
    PRIMARY KEY (emp_id, month)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS advances (
    id            VARCHAR(20) PRIMARY KEY,
    emp_id        VARCHAR(16) NOT NULL,
    emp_name      VARCHAR(120),
    date          VARCHAR(12),
    amount        INT DEFAULT 0,
    reason        VARCHAR(255),
    monthly_recovery INT DEFAULT 0,
    recovered     INT DEFAULT 0,
    status        VARCHAR(12) DEFAULT 'Active',
    INDEX (emp_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS monthly_deductions (
    emp_id      VARCHAR(16) NOT NULL,
    month       VARCHAR(7) NOT NULL,
    mess        INT DEFAULT 0,
    others      INT DEFAULT 0,
    others_note VARCHAR(255),
    PRIMARY KEY (emp_id, month)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS weekly_payments (
    emp_id    VARCHAR(16) NOT NULL,
    month     VARCHAR(7) NOT NULL,
    week_idx  INT NOT NULL,
    paid_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (emp_id, month, week_idx)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS appraisals (
    emp_id       VARCHAR(16) NOT NULL,
    cycle        VARCHAR(20) NOT NULL,
    productivity DECIMAL(3,1), quality DECIMAL(3,1), attendance DECIMAL(3,1),
    discipline   DECIMAL(3,1), teamwork DECIMAL(3,1), overall DECIMAL(3,1),
    increment_pct INT DEFAULT 0,
    note         TEXT,
    finalized_on VARCHAR(12),
    PRIMARY KEY (emp_id, cycle)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS leave_requests (
    id         VARCHAR(20) PRIMARY KEY,
    emp_id     VARCHAR(16),
    emp_name   VARCHAR(120),
    type       VARCHAR(8),
    from_date  VARCHAR(12),
    to_date    VARCHAR(12),
    days       INT DEFAULT 0,
    reason     VARCHAR(255),
    status     VARCHAR(24),
    applied_on VARCHAR(12),
    INDEX (emp_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS payslip_log (
    id        VARCHAR(24) PRIMARY KEY,
    emp_id    VARCHAR(16),
    emp_name  VARCHAR(120),
    channel   VARCHAR(12),
    month     VARCHAR(40),
    net_pay   INT DEFAULT 0,
    sent_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS transfer_batches (
    id        VARCHAR(24) PRIMARY KEY,
    month     VARCHAR(40),
    count     INT DEFAULT 0,
    total     INT DEFAULT 0,
    bank_file VARCHAR(120),
    status    VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS audit_log (
    id      VARCHAR(20) PRIMARY KEY,
    at      VARCHAR(40),
    by_user VARCHAR(120),
    module  VARCHAR(40),
    action  VARCHAR(80),
    detail  VARCHAR(400),
    emp_id  VARCHAR(16) NULL,
    INDEX (emp_id), INDEX (module)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS recycle_bin (
    id         VARCHAR(20) PRIMARY KEY,
    type       VARCHAR(16),
    label      VARCHAR(160),
    sub        VARCHAR(200),
    data       JSON,
    deleted_by VARCHAR(120),
    deleted_at VARCHAR(40),
    INDEX (type)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // HR login accounts — one per HR staff member so every change in audit_log
  // is attributed to a real login, not a free-typed display name. Demo-grade
  // auth: plain-text password, checked client-side (see stores/hr.ts).
  `CREATE TABLE IF NOT EXISTS hr_users (
    id         VARCHAR(20) PRIMARY KEY,
    login_id   VARCHAR(60) NOT NULL UNIQUE,
    password   VARCHAR(120) NOT NULL,
    name       VARCHAR(120) NOT NULL,
    role       VARCHAR(20) NOT NULL,
    active     TINYINT(1) DEFAULT 1,
    created_at VARCHAR(40),
    created_by VARCHAR(120)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // Central app settings — currently the go-live data lock. Kept server-side so
  // every machine sees the same lock state and a stale tab can't overwrite
  // master data that has been frozen for statutory filing.
  `CREATE TABLE IF NOT EXISTS app_settings (
    k          VARCHAR(60) PRIMARY KEY,
    v          JSON,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

/**
 * Column additions to tables that may already exist from an earlier schema
 * version (CREATE TABLE IF NOT EXISTS won't add columns to a table that's
 * already there). Each statement must be safe to re-run.
 */
export const MIGRATIONS: string[] = [
  `ALTER TABLE attendance ADD COLUMN IF NOT EXISTS week_shift_ids JSON`,
  `ALTER TABLE employees ADD COLUMN IF NOT EXISTS father_name VARCHAR(120)`,
  `ALTER TABLE employees ADD COLUMN IF NOT EXISTS referred_by VARCHAR(120)`,
  `ALTER TABLE employees ADD COLUMN IF NOT EXISTS exit_record JSON`,
  `ALTER TABLE employees ADD COLUMN IF NOT EXISTS rejoins JSON`,
  `ALTER TABLE employees ADD COLUMN IF NOT EXISTS training JSON`,
  `ALTER TABLE employees ADD COLUMN IF NOT EXISTS unit VARCHAR(80)`,
  `ALTER TABLE employees ADD COLUMN IF NOT EXISTS location VARCHAR(120)`,
  `ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_name VARCHAR(80)`,
  `ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_branch VARCHAR(80)`,
  `ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_account VARCHAR(40)`,
  `ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_ifsc VARCHAR(20)`,
];
