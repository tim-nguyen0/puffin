.PHONY: up down logs procs doctor

up:
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f --tail=100

procs:
	docker compose exec sim supervisorctl status

doctor:
	@echo "--- supervisord ---"
	-docker compose exec sim supervisorctl status
	@echo "--- gz topics ---"
	-docker compose exec sim gz topic -l
	@echo "--- ros topics ---"
	-docker compose exec sim bash -lc "source /opt/ros/jazzy/setup.bash && ros2 topic list"
