# Strongly connected components of src/ import graph. Usage: python3 cycles.py edges.tsv [value|all]
import sys, collections
mode = sys.argv[2] if len(sys.argv) > 2 else 'value'
g = collections.defaultdict(set)
for line in open(sys.argv[1]):
    a, b, k = line.rstrip('\n').split('\t')
    if k == 'mock': continue
    if mode == 'value' and k == 'type': continue
    if a.endswith(('.test.ts', '.test.tsx')): continue
    g[a].add(b)
sys.setrecursionlimit(100000)
idx = {}; low = {}; st = []; on = set(); out = []; c = [0]
def sc(v):
    idx[v] = low[v] = c[0]; c[0] += 1; st.append(v); on.add(v)
    for w in g.get(v, ()):
        if w not in idx: sc(w); low[v] = min(low[v], low[w])
        elif w in on: low[v] = min(low[v], idx[w])
    if low[v] == idx[v]:
        comp = []
        while True:
            w = st.pop(); on.discard(w); comp.append(w)
            if w == v: break
        if len(comp) > 1: out.append(sorted(comp))
for v in list(g):
    if v not in idx: sc(v)
for comp in out:
    print(len(comp), ' '.join(comp))
    s = set(comp)
    for a in comp:
        for b in sorted(g[a] & s): print('   ', a, '->', b)
