import re

with open('client/src/components/RouteNavigator.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

replacements = [
    (r"'#F1F5F9'", "'var(--text-primary)'"),
    (r"'#475569'", "'var(--text-secondary)'"),
    (r"'#94A3B8'", "'var(--text-secondary)'"),
    (r"'#334155'", "'var(--text-muted)'"),
    (r"'rgba\(255,255,255,0\.02\)'", "'var(--subtle-bg)'"),
    (r"'rgba\(255,255,255,0\.03\)'", "'var(--subtle-bg)'"),
    (r"'rgba\(255,255,255,0\.04\)'", "'var(--subtle-bg)'"),
    (r"'rgba\(255,255,255,0\.05\)'", "'var(--subtle-bg)'"),
    (r"'rgba\(255,255,255,0\.06\)'", "'var(--subtle-border)'"),
    (r"'rgba\(255,255,255,0\.07\)'", "'var(--subtle-border)'"),
    (r"'rgba\(255,255,255,0\.08\)'", "'var(--subtle-border-strong)'"),
    (r"'rgba\(255,255,255,0\.09\)'", "'var(--subtle-border-strong)'"),
    (r"'rgba\(13,18,35,0\.98\)'", "'var(--dropdown-bg)'"),
    (r"'rgba\(0,0,0,0\.6\)'", "'var(--shadow-color)'"),
]

for old, new in replacements:
    content = re.sub(old, new, content)

content = content.replace("color: '#64748B'", "color: 'var(--text-muted)'")

with open('client/src/components/RouteNavigator.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done RouteNavigator")

with open('client/src/components/AdminPanel.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

for old, new in replacements:
    content = re.sub(old, new, content)

content = content.replace("color: '#64748B'", "color: 'var(--text-muted)'")

with open('client/src/components/AdminPanel.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done AdminPanel")

with open('client/src/components/Sidebar.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

for old, new in replacements:
    content = re.sub(old, new, content)

content = content.replace("color: '#64748B'", "color: 'var(--text-muted)'")

with open('client/src/components/Sidebar.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done Sidebar")
