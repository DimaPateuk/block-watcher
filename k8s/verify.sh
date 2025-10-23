#!/bin/bash

echo "🔍 Verifying Observability Stack"
echo "================================"

# Check pods
echo "1. Pod Status:"
kubectl get pods -n block-watcher
kubectl get pods -n observability | grep -E "(prometheus|grafana|alertmanager)"

echo ""
echo "2. Testing App Metrics:"
kubectl port-forward svc/block-watcher-service 8080:80 -n block-watcher >/dev/null 2>&1 &
PID=$!
sleep 3

if curl -s http://localhost:8080/api/metrics | head -3 | grep -q "nodejs"; then
    echo "✅ Metrics endpoint working"
else
    echo "❌ Metrics endpoint not working"
fi

kill $PID 2>/dev/null

echo ""
echo "3. Prometheus Targets:"
kubectl port-forward svc/observability-kube-prometheus-prometheus 9090:9090 -n observability >/dev/null 2>&1 &
PID=$!
sleep 3

echo "Visit http://localhost:9090/targets to check if block-watcher target is discovered"
kill $PID 2>/dev/null

echo ""
echo "4. ServiceMonitor Status:"
kubectl get servicemonitor -n observability

echo ""
echo "✅ Verification complete!"
echo ""
echo "Next steps:"
echo "- Open Grafana: kubectl port-forward svc/observability-grafana 3000:80 -n observability"
echo "- Check Prometheus targets: kubectl port-forward svc/observability-kube-prometheus-prometheus 9090:9090 -n observability"
echo "- View app logs: kubectl logs -l app=block-watcher -n block-watcher -f"
