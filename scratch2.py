import re

files = [
    'client/src/components/admin/DashboardTab.jsx',
    'client/src/components/admin/UsersTab.jsx',
    'client/src/components/Header.jsx'
]

replacements = [
    (r"'#F1F5F9'", "'var(--text-primary)'"),
    (r"'#475569'", "'var(--text-secondary)'"),
    (r"'#94A3B8'", "'var(--text-secondary)'"),
    (r"'#64748B'", "'var(--text-muted)'"),
    (r"'#334155'", "'var(--text-muted)'"),
    (r"'rgba\(255,255,255,0\.02\)'", "'var(--subtle-bg)'"),
    (r"'rgba\(255,255,255,0\.03\)'", "'var(--subtle-bg)'"),
    (r"'rgba\(255,255,255,0\.04\)'", "'var(--subtle-bg)'"),
    (r"'rgba\(255,255,255,0\.05\)'", "'var(--subtle-bg)'"),
    (r"'rgba\(255,255,255,0\.06\)'", "'var(--subtle-border)'"),
    (r"'rgba\(255,255,255,0\.07\)'", "'var(--subtle-border)'"),
    (r"'rgba\(255,255,255,0\.08\)'", "'var(--subtle-border-strong)'"),
    (r"'rgba\(255,255,255,0\.09\)'", "'var(--subtle-border-strong)'"),
    (r"'rgba\(255,255,255,0\.1\)'", "'var(--subtle-border-strong)'"),
    (r"'rgba\(13,18,35,0\.98\)'", "'var(--dropdown-bg)'"),
    (r"'rgba\(0,0,0,0\.6\)'", "'var(--shadow-color)'"),
    (r"'rgba\(7, 11, 22, 0\.98\)'", "'var(--header-bg)'"),
]

for filepath in files:
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        for old, new in replacements:
            content = re.sub(old, new, content)

        # Some specific cleanups
        content = content.replace("color: '#22D3EE'", "color: 'var(--accent-cyan)'") # In Header
        content = content.replace("color: '#34D399'", "color: 'var(--success)'") # In Header
        content = content.replace("color: '#FBBF24'", "color: 'var(--primary-amber-light)'") # In Header
        content = content.replace("color: '#60A5FA'", "color: 'var(--accent-cyan-light)'") # Or something
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

        print(f"Done {filepath}")
    except FileNotFoundError:
        print(f"File not found: {filepath}")

